// scoring.test.js — pins the accuracy math (run with `npm test`).
import test from 'node:test';
import assert from 'node:assert/strict';
import { accuracyPercent, pointsEarned, averageAccuracy } from '../src/scoring.js';

test('all right = 100%', () => {
  const actions = Array.from({ length: 8 }, () => ({ verdict: 'right' }));
  assert.equal(accuracyPercent(actions, 8), 100);
});

test('all wrong = 0%', () => {
  const actions = Array.from({ length: 12 }, () => ({ verdict: 'wrong' }));
  assert.equal(accuracyPercent(actions, 12), 0);
});

test('partial counts as half', () => {
  const actions = [{ verdict: 'right' }, { verdict: 'partial' }, { verdict: 'wrong' }, { verdict: 'right' }];
  assert.equal(pointsEarned(actions), 2.5);
  assert.equal(accuracyPercent(actions, 4), 63); // 2.5/4 = 62.5 -> 63
});

test('class average by group', () => {
  assert.equal(averageAccuracy([{ accuracy: 80 }, { accuracy: 90 }, { accuracy: 70 }]), 80);
  assert.equal(averageAccuracy([]), 0);
});
