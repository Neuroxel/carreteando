import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eventosDeLugares, indiceDeLugares } from '../lib/venue-match';

const catalogo = [
  { slug: 'manda-vina', nombre: 'Manda', ciudad: 'Viña del Mar', alias: ['Manda Viña'] },
  { slug: 'manda-renaca', nombre: 'Manda', ciudad: 'Reñaca', alias: ['Manda Reñaca'] },
  { slug: 'bar-vienes', nombre: 'Bar Vienés', ciudad: 'Viña del Mar', alias: ['Vienes Bar'] },
];
const events = [
  { id: 'm-v', lugar: 'Manda', ciudad: 'Viña del Mar' },
  { id: 'm-r', lugar: 'Manda', ciudad: 'Reñaca' },
  { id: 'alias', lugar: 'Vienes Bar', ciudad: 'Viña del Mar' },
  { id: 'unknown', lugar: 'Manda', ciudad: 'Concón' },
  { id: 'no-place', lugar: null, ciudad: 'Viña del Mar' },
];
test('zone agenda resolves stable slugs and source-reviewed aliases without cross-city leakage', () => {
  assert.deepEqual(
    eventosDeLugares(events, catalogo, new Set(['manda-vina', 'bar-vienes'])).map((e) => e.id),
    ['m-v', 'alias'],
  );
  assert.deepEqual(
    eventosDeLugares(events, catalogo, new Set(['manda-renaca'])).map((e) => e.id),
    ['m-r'],
  );
  assert.equal(eventosDeLugares(events, catalogo, new Set(['missing'])).length, 0);
});
test('ambiguous place without city cannot count toward one of two venues', () => {
  const identify = indiceDeLugares(catalogo);
  assert.equal(identify('Manda', null), null);
  assert.equal(identify('Manda', 'Viña del Mar'), 'manda-vina');
  assert.equal(identify('Manda', 'Reñaca'), 'manda-renaca');
});
