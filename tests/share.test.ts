import test from 'node:test';
import assert from 'node:assert/strict';
import { shareUrl } from '../lib/share';
test('venue sharing opens the venue route, not an encoded event id', () => {
  assert.equal(new URL(shareUrl('lugar/teatro-mauri-scd')).pathname, '/lugar/teatro-mauri-scd');
});
test('event identifiers cannot escape the event route', () => {
  assert.equal(new URL(shareUrl('a/b?c')).pathname, '/evento/a%2Fb%3Fc');
});
