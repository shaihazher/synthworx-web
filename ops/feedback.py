"""Read product feedback and keep private decisions across daily and weekly runs."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import sqlite3
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
PRODUCTS = json.loads((ROOT / 'feedback-products.json').read_text())
CADENCES = ('daily', 'weekly')
STATES = ('open', 'fixed', 'closed', 'qa', 'seen')
IDENTIFIER = re.compile(r'(?im)^\s*(Feedback|Inquiry) ID:\s*([\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12})\s*$')


class Text(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []

    def handle_data(self, data):
        self.parts.append(data)

    def handle_starttag(self, tag, attrs):
        if tag in ('br', 'div', 'p', 'li', 'tr'):
            self.parts.append('\n')

    def handle_endtag(self, tag):
        if tag in ('div', 'p', 'li', 'tr'):
            self.parts.append('\n')


def mail_text(body):
    if not re.search(r'<(?:html|div|span|br|p|a|table|blockquote)\b', body, re.I):
        return body
    parser = Text()
    parser.feed(body)
    return '\n'.join(line.strip() for line in ''.join(parser.parts).splitlines() if line.strip())


def source(kind, slug):
    command = ['node', 'ops/feedback-sources.mjs', kind, slug]
    if kind == 'volume':
        command = ['railway', 'ssh', '--', *command]
    run = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, timeout=120)
    if run.returncode:
        detail = next((line.strip() for line in run.stderr.splitlines() if line.startswith('Error:')), '')
        raise RuntimeError(detail or f'{command[0]} exited {run.returncode}')
    return json.loads(next(line for line in run.stdout.splitlines() if line.lstrip().startswith('{')))


def collect(db, origin):
    errors, parts = {}, {}
    with ThreadPoolExecutor(2) as pool:
        futures = {kind: pool.submit(source, kind, origin) for kind in ('volume', 'mail')}
        for kind, future in futures.items():
            try:
                parts[kind] = future.result()
            except Exception as error:
                errors[kind] = str(error) or type(error).__name__
    volume = parts.get('volume', {})
    archived = set(volume.get('qa', []))
    current = {row['ref']: row for row in volume.get('rows', [])}
    copies = {}
    for original in parts.get('mail', {}).get('rows', []):
        row = dict(original)
        row['body'] = mail_text(row['body'])
        if row.get('own'):
            ids = IDENTIFIER.findall(row['body'])
            if not ids:
                continue
            kind, value = ids[-1]
            ref = ('form:' if kind.lower() == 'feedback' else 'inquiry:') + value.lower()
            copies[ref] = row['at']
            if ref in archived or ref in current:
                continue
            row['ref'] = ref
            row['delivery'] = 'Zoho copy only; reconcile with the production record'
        current[row['ref']] = row
    stamp = time.time_ns()
    with db:
        for ref, row in current.items():
            db.execute('INSERT OR IGNORE INTO items(ref,origin,product,at,changed) VALUES(?,?,?,?,?)',
                       (ref, origin, origin, row['at'], stamp))
        for ref in archived:
            if ref in copies:
                db.execute("INSERT OR IGNORE INTO items(ref,origin,product,at,status,changed) VALUES(?,?,?,?,'qa',?)",
                           (ref, origin, origin, copies[ref], stamp))
            db.execute("UPDATE items SET status='qa' WHERE ref=? AND origin=?", (ref, origin))
    return current, {'formRecords': len(volume.get('rows', [])) if 'volume' in parts else None,
                     'mailMessages': len(parts['mail']['rows']) if 'mail' in parts else None,
                     'websiteCopies': len(copies), 'archivedTestCopies': len(archived.intersection(copies)),
                     'errors': errors}, volume.get('ratings')


def connection(directory):
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    db = sqlite3.connect(directory / 'reviews.sqlite', timeout=25)
    db.row_factory = sqlite3.Row
    db.executescript('''CREATE TABLE IF NOT EXISTS items(
      ref TEXT PRIMARY KEY, origin TEXT NOT NULL, product TEXT NOT NULL, at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new', decision TEXT, proof TEXT, due TEXT,
      changed INTEGER NOT NULL, daily INTEGER NOT NULL DEFAULT 0, weekly INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS history(ref TEXT, at TEXT, product TEXT, cadence TEXT,
        action TEXT, decision TEXT, proof TEXT, due TEXT);
      CREATE TABLE IF NOT EXISTS checks(product TEXT, cadence TEXT, at TEXT, sources TEXT);''')
    return db


def review(db, args):
    origins = {args.product} | {r[0] for r in db.execute('SELECT DISTINCT origin FROM items WHERE product=?', (args.product,))}
    checks, bodies, ratings = {}, {}, None
    for origin in sorted(origins):
        rows, checks[origin], score = collect(db, origin)
        bodies.update(rows)
        if origin == args.product:
            ratings = score
    # A decision made on one cadence stays visible on the other until it is reviewed there.
    items = []
    for row in db.execute('SELECT * FROM items WHERE product=? ORDER BY at,ref', (args.product,)):
        if row['status'] == 'qa' or (row['status'] not in ('new', 'open') and row[args.cadence] >= row['changed']):
            continue
        item = {k: row[k] for k in ('ref', 'origin', 'at', 'status', 'decision', 'proof', 'due')}
        item.update(bodies.get(row['ref'], {}))
        items.append(item)
    now = datetime.now(timezone.utc).isoformat()
    with db:
        db.execute('INSERT INTO checks VALUES(?,?,?,?)', (args.product, args.cadence, now, json.dumps(checks)))
    result = dict(product=args.product, cadence=args.cadence, checked=now, sources=checks, awaitingReview=len(items))
    if not args.summary:
        result['items'] = items
    if args.cadence == 'weekly':
        start = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        history = db.execute('SELECT ref,at,cadence,action,decision,proof,due FROM history '
                             'WHERE product=? AND at>=? AND action!=? ORDER BY at', (args.product, start, 'qa'))
        changes = [dict(entry) for entry in history]
        result['decisionsLastSevenDays'] = len(changes) if args.summary else changes
    if args.product == 'outcome-prompt':
        result['ratingsByRewriteDayUTC'] = ratings
    print(json.dumps(result, ensure_ascii=False, indent=None if args.summary else 2))
    return int(any(s['errors'] for s in checks.values()))


def change(db, args):
    now = datetime.now(timezone.utc).isoformat()
    stamp = time.time_ns()
    with db:
        db.execute('BEGIN IMMEDIATE')
        if args.command == 'add':
            db.execute('INSERT OR IGNORE INTO items(ref,origin,product,at,decision,changed) VALUES(?,?,?,?,?,?)',
                       (args.ref, args.product, args.product, now, args.note, stamp))
            row = db.execute('SELECT product FROM items WHERE ref=?', (args.ref,)).fetchone()
            if row['product'] != args.product:
                raise ValueError('Reference already belongs to ' + row['product'])
            return
        row = db.execute('SELECT * FROM items WHERE ref=? AND product=?', (args.ref, args.product)).fetchone()
        if row is None:
            raise ValueError('Use a reference in this product’s review or add the source reference first')
        proof, due = getattr(args, 'proof', None), getattr(args, 'next', None)
        if due:
            date.fromisoformat(due)
        if args.command == 'route':
            if args.to == args.product:
                raise ValueError('Choose the product that owns the fix')
            db.execute("UPDATE items SET product=?,status='open',decision=?,proof=NULL,due=?,changed=? WHERE ref=?",
                       (args.to, args.note, due, stamp, args.ref))
            action = 'routed to ' + args.to
        else:
            action = args.state
            if action == 'seen':
                if row['status'] == 'new':
                    raise ValueError('Give a new note a disposition first')
                db.execute(f'UPDATE items SET {args.cadence}=? WHERE ref=?', (stamp, args.ref))
            else:
                if action == 'fixed' and not (proof or '').strip():
                    raise ValueError('Supply --proof with the verified customer path and result')
                if action == 'open' and not due:
                    raise ValueError('Supply --next YYYY-MM-DD for the follow-up')
                db.execute(f'UPDATE items SET status=?,decision=?,proof=?,due=?,changed=?,{args.cadence}=? WHERE ref=?',
                           (action, args.note, proof, due, stamp, stamp, args.ref))
        db.execute('INSERT INTO history VALUES(?,?,?,?,?,?,?,?)',
                   (args.ref, now, args.product, args.cadence, action, args.note, proof, due))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    for name in ('review', 'record', 'route', 'add'):
        p = sub.add_parser(name)
        p.add_argument('product', choices=PRODUCTS)
        if name != 'add':
            p.add_argument('cadence', choices=CADENCES)
        if name == 'review':
            p.add_argument('--summary', action='store_true', help='Counts only. Does not acknowledge any note.')
            continue
        p.add_argument('ref')
        if name == 'record':
            p.add_argument('state', choices=STATES)
            p.add_argument('--proof')
            p.add_argument('--next')
        elif name == 'route':
            p.add_argument('to', choices=PRODUCTS)
            p.add_argument('--next', required=True)
        p.add_argument('note', help='Private decision and next action, without personal information')
    args = parser.parse_args()
    if hasattr(args, 'note') and not args.note.strip():
        parser.error('Enter a decision or source description')
    os.umask(0o077)
    state = Path(os.environ.get('SYNTHWORX_FEEDBACK_STATE', Path.home() / '.local/state/synthworx/feedback'))
    db = connection(state)
    try:
        return review(db, args) if args.command == 'review' else change(db, args)
    except ValueError as error:
        parser.error(str(error))
    finally:
        db.close()


if __name__ == '__main__':
    sys.exit(main())
