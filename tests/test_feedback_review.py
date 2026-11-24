import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch
from uuid import uuid4

spec = importlib.util.spec_from_file_location('feedback', Path(__file__).resolve().parents[1] / 'ops/feedback.py')
feedback = importlib.util.module_from_spec(spec)
spec.loader.exec_module(feedback)
UID = 'a1111111-a111-a111-a111-a11111111111'
QA = 'b2222222-b222-b222-b222-b22222222222'


class ReviewTest(unittest.TestCase):
    def setUp(self):
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        self.db = feedback.connection(Path(folder.name))
        self.addCleanup(self.db.close)
        self.note = dict(ref='form:' + UID, at='2026-10-01', body='A receipt lost my change')
        self.volume = dict(rows=[self.note], qa=['form:' + QA])
        self.mail = dict(rows=[dict(ref='mail:1', at='2026-11-01', own=True, body=f'<div>Feedback ID: {QA}</div><div>Feedback ID: {UID}</div>'),
                               dict(ref='mail:2', at='2026-11-01', own=True, body='Feedback ID: ' + QA),
                               dict(ref='mail:3', at='2026-11-01', own=False, body='Feedback ID: ' + UID)])
        self.failed = False

    def source(self, kind, product):
        if kind == 'volume' and self.failed:
            raise RuntimeError('Railway unavailable')
        if product != 'synthworx':
            return {'rows': []}
        return self.volume if kind == 'volume' else self.mail

    def read(self, cadence='daily', product='synthworx'):
        capture = io.StringIO()
        with patch.object(feedback, 'source', self.source), contextlib.redirect_stdout(capture):
            status = feedback.review(self.db, SimpleNamespace(product=product, cadence=cadence, summary=False))
        return status, json.loads(capture.getvalue())

    def record(self, cadence, state, **extra):
        feedback.change(self.db, SimpleNamespace(command='record', product='synthworx', cadence=cadence,
                                                  ref=self.note['ref'], state=state, note='Buyer path checked', **extra))

    def test_copies_and_weekly_review_of_a_daily_fix(self):
        _, daily = self.read()
        self.assertEqual({n['ref'] for n in daily['items']}, {self.note['ref'], 'mail:3'})
        self.assertEqual(daily['sources']['synthworx']['archivedTestCopies'], 1)
        with self.assertRaises(ValueError): self.record('daily', 'fixed')
        self.record('daily', 'fixed', proof='Published change, re-opened receipt and the change persisted')
        self.assertEqual(self.read()[1]['awaitingReview'], 1)
        _, weekly = self.read('weekly')
        self.assertEqual(weekly['awaitingReview'], 2)
        self.assertEqual(next(n['status'] for n in weekly['items'] if n['ref']==self.note['ref']), 'fixed')
        self.record('weekly', 'seen')
        self.assertEqual(self.read('weekly')[1]['awaitingReview'], 1)
        self.record('weekly', 'open', next='2026-11-30')
        self.assertEqual(self.read()[1]['awaitingReview'], 2)

    def test_routing_and_partial_source_failure(self):
        self.read()
        feedback.change(self.db, SimpleNamespace(command='route', product='synthworx', cadence='daily',
                        ref=self.note['ref'], to='arrival-slip', note='Receipt operator will check', next='2026-11-30'))
        self.assertEqual(self.read('weekly', 'arrival-slip')[1]['items'][0]['body'], self.note['body'])
        self.failed = True
        status, partial = self.read()
        self.assertNotEqual(status, 0)
        self.assertIsNone(partial['sources']['synthworx']['formRecords'])
        self.assertIn('volume', partial['sources']['synthworx']['errors'])
        self.assertIn('mail:3', {r['ref'] for r in partial['items']})

    def test_intermittent_transport_failure_is_retried(self):
        failed = SimpleNamespace(returncode=1, stderr='Error: connection closed', stdout='')
        success = SimpleNamespace(returncode=0, stderr='', stdout='{"rows":[]}\n')
        with patch.object(feedback.subprocess, 'run', side_effect=[failed, success]) as call, patch.object(feedback.time, 'sleep'):
            self.assertEqual(feedback.source('volume', 'synthworx'), {'rows': []})
            self.assertEqual(call.call_count, 2)


class VolumeTest(unittest.TestCase):
    def test_each_product_reaches_its_own_review_and_native_channels_are_included(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            def store(folder, **fields):
                target = root / folder
                target.mkdir(parents=True, exist_ok=True)
                uid = str(uuid4())
                (target / (uid + '.json')).write_text(json.dumps(dict(id=uid, **fields)))
                return uid

            forms = {slug: store('product-feedback', product=p['name'], received='2026-11-24', message=slug)
                     for slug, p in feedback.PRODUCTS.items()}
            native = store('federal-evidence-desk/feedback', at='2026-11-20', message='Earlier offline report')
            inquiry = store('audience-cut', received='2026-11-24', decision='Can the editor use the brief?')
            qa = store('product-feedback/qa', product='Arrival Slip', received='2026-11-24', message='Internal check')
            (root / 'outcome-prompt').mkdir()
            with sqlite3.connect(root / 'outcome-prompt/activity.sqlite') as db:
                db.executescript('''CREATE TABLE sessions(id,qa); CREATE TABLE runs(at,bucket,sid,rating,status);
                    INSERT INTO sessions VALUES('visitor',0),('test',1);
                    INSERT INTO runs VALUES(1700000000000,'visitor','visitor','missed','ready'),
                                           (1700000000000,'test','test','closer','ready');''')
            for slug, uid in forms.items():
                run = subprocess.run(['node','ops/feedback-sources.mjs','volume',slug], cwd=feedback.ROOT,
                    env=dict(os.environ, RAILWAY_VOLUME_MOUNT_PATH=directory), capture_output=True, text=True, check=True)
                data = json.loads(run.stdout)
                expected = {'form:' + uid}
                if slug == 'federal-desk': expected.add('form:' + native)
                if slug == 'audience-cut': expected.add('inquiry:' + inquiry)
                self.assertEqual({row['ref'] for row in data['rows']}, expected)
                if slug == 'arrival-slip': self.assertEqual(data['qa'], ['form:' + qa])
                if slug == 'outcome-prompt':
                    self.assertEqual([(r['completed'], r['closer'], r['missed']) for r in data['ratings']], [(1, 0, 1)])
