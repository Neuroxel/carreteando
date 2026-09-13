import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sourceFreshness } from '../lib/freshness';
test('source freshness distinguishes failure, stalled run and missing evidence', () => {
  const now = Date.parse('2026-09-13T16:00:00Z');
  const run = {
    status: 'succeeded',
    started_at: '2026-09-13T15:59:00Z',
    completed_at: '2026-09-13T16:00:00Z',
  };
  assert.equal(sourceFreshness(null, now), 'unknown');
  assert.equal(sourceFreshness(run, now), 'fresh');
  assert.equal(sourceFreshness(run, now + 37 * 3600000), 'delayed');
  assert.equal(sourceFreshness({ ...run, status: 'failed' }, now), 'delayed');
  assert.equal(sourceFreshness({ ...run, status: 'running' }, now), 'updating');
  assert.equal(sourceFreshness({ ...run, status: 'running' }, now + 600000), 'delayed');
  assert.equal(sourceFreshness({ ...run, completed_at: 'invalid' }, now), 'unknown');
});
