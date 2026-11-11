import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ciudadEnFiltro } from '../lib/venues';
import { dbRowToEvento, filterEvents } from '../lib/events';

const evento = (city: string, suffix: string) =>
  dbRowToEvento({
    instagram_id: 'prueba-' + suffix,
    title: 'Música en vivo ' + suffix,
    date_text: '2026-11-27',
    event_time: '21:00',
    city,
    venue: 'Sala ' + suffix,
    category: 'rock',
    is_active: true,
    moderation_status: 'approved',
  })!;

test('Viña municipal filter includes legacy Reñaca events while Reñaca shortcut stays narrow', () => {
  const vina = evento('Viña del Mar', 'vina');
  const renaca = evento('Reñaca', 'renaca');
  assert.ok(vina && renaca);
  assert.equal(ciudadEnFiltro('Reñaca', 'Viña del Mar'), true);
  assert.equal(ciudadEnFiltro('Viña del Mar', 'Reñaca'), false);
  assert.equal(ciudadEnFiltro('Concón', 'Viña del Mar'), false);
  assert.equal(filterEvents([vina, renaca], { ciudad: 'Viña del Mar', fecha: 'futuro' }, '2026-11-11').length, 2);
  assert.deepEqual(
    filterEvents([vina, renaca], { ciudad: 'Reñaca', fecha: 'futuro' }, '2026-11-11').map((e) => e.ciudad),
    ['Reñaca'],
  );
  assert.equal(filterEvents([vina, renaca], { ciudad: 'Concón', fecha: 'futuro' }, '2026-11-11').length, 0);
});
