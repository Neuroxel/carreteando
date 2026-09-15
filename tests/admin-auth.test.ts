import assert from 'node:assert/strict';
import test from 'node:test';
import {
  loginOutcome,
  normalizeSecret,
  sameSecret,
  validSession,
} from '../lib/admin-session';

// The clave that was actually in production, shaped like the real one.
const SECRET = 'k'.repeat(48);

test('normalizeSecret survives the shapes a secret manager produces', () => {
  assert.equal(normalizeSecret(SECRET), SECRET);
  assert.equal(normalizeSecret(`${SECRET}\n`), SECRET, 'trailing newline must not change the clave');
  assert.equal(normalizeSecret(`  ${SECRET}  `), SECRET);
  assert.equal(normalizeSecret(undefined), null);
  assert.equal(normalizeSecret(''), null);
  assert.equal(normalizeSecret('   '), null);
  assert.equal(normalizeSecret('a'.repeat(42)), null, 'a short value is a misconfiguration, not a clave');
});

test('every login failure names its own cause', () => {
  assert.equal(loginOutcome(SECRET, SECRET, true, true), 'ok');
  assert.equal(loginOutcome('otra-clave', SECRET, true, true), 'mismatch');
  assert.equal(loginOutcome('', SECRET, true, true), 'mismatch');
  assert.equal(loginOutcome('x'.repeat(201), SECRET, true, true), 'mismatch');
  // A build deployed before the variable existed looks exactly like a wrong clave.
  assert.equal(loginOutcome(SECRET, null, true, true), 'no-secret');
  assert.equal(loginOutcome(SECRET, SECRET, false, true), 'no-db');
  assert.equal(loginOutcome(SECRET, SECRET, true, 'error'), 'db-error');
  assert.equal(loginOutcome(SECRET, SECRET, true, false), 'rate-limited');
});

test('a stale deployment rejects the current clave', () => {
  // Exactly the reported failure: the owner types the new clave, the running
  // build still holds the previous one.
  const previous = 'j'.repeat(48);
  assert.equal(loginOutcome(SECRET, previous, true, true), 'mismatch');
});

test('the quota is spent before the clave is compared', () => {
  // Otherwise the rate limit could be probed with wrong claves for free.
  assert.equal(loginOutcome('otra-clave', SECRET, true, false), 'rate-limited');
});

test('sameSecret compares without leaking length through a throw', () => {
  assert.equal(sameSecret(SECRET, SECRET), true);
  assert.equal(sameSecret('a', 'b'), false);
  assert.equal(sameSecret('a', 'a'.repeat(300)), false);
});

test('a session cookie is only valid signed, unexpired and well formed', () => {
  const now = 1_700_000_000_000;
  const { createHmac } = require('node:crypto') as typeof import('node:crypto');
  const sign = (payload: string) =>
    createHmac('sha256', SECRET).update(`admin-session-v1|${payload}`).digest('base64url');
  const payload = `${now + 3_600_000}.${'a'.repeat(32)}`;
  assert.equal(validSession(`${payload}.${sign(payload)}`, SECRET, now), true);
  assert.equal(validSession(`${payload}.${sign(payload)}`, null, now), false, 'no secret, no session');
  assert.equal(validSession(`${payload}.${sign(payload)}`, 'z'.repeat(48), now), false);
  assert.equal(validSession(`${payload}.nope`, SECRET, now), false);
  assert.equal(validSession(undefined, SECRET, now), false);
  const expired = `${now - 1}.${'a'.repeat(32)}`;
  assert.equal(validSession(`${expired}.${sign(expired)}`, SECRET, now), false);
  // A cookie that claims more than the two hours the page promises.
  const overlong = `${now + 7_200_001 + 1000}.${'a'.repeat(32)}`;
  assert.equal(validSession(`${overlong}.${sign(overlong)}`, SECRET, now), false);
  const extra = `${payload}.${sign(payload)}.extra`;
  assert.equal(validSession(extra, SECRET, now), false);
});
