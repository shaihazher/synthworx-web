import contextlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

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
