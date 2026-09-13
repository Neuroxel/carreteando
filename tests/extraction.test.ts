import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractEventDate,
  extractEventTime,
  extractPriceInfo,
  inferCity,
  isLikelyEventPost,
  toChileDateString,
} from '../lib/event-extraction';
const base = '2026-09-12T22:00:00Z';
test('missing/invalid publication timestamps never become today', () => {
  assert.equal(extractEventDate('Fiesta hoy'), null);
  assert.equal(extractEventDate('Fiesta mañana', 'invalid'), null);
});
test('explicit dates, weekdays and Chile midnight', () => {
  for (const caption of [
    'sábado 19',
    'sábado 19 de septiembre',
    '19 septiembre',
    '19/09',
    '19-09',
    '19/09/2026',
  ])
    assert.equal(extractEventDate(caption, base), '2026-09-19', caption);
  assert.equal(extractEventDate('hoy', '2026-09-13T02:30:00Z'), '2026-09-12');
  assert.equal(extractEventDate('mañana', base), '2026-09-13');
  assert.equal(extractEventDate('este viernes', base), '2026-09-18');
  assert.equal(toChileDateString('2026-09-06T04:30:00Z'), '2026-09-06');
});
test('ambiguity, impossible dates and mismatched weekdays are rejected', () => {
  for (const caption of [
    '31/02 fiesta hoy',
    'viernes 19 de septiembre',
    'fiesta 19/09 y 20/09',
    'fiesta todos los viernes',
    'fiesta 19 y 20 de septiembre',
  ])
    assert.equal(extractEventDate(caption, base), null, caption);
});
test('expired month is not silently rolled forward a year', () =>
  assert.equal(extractEventDate('fiesta 19 de marzo', base), '2026-03-19'));
test('time extraction does not read decimal prices or numeric dates as hours', () => {
  assert.equal(extractEventTime('Preventa $15.000'), null);
  assert.equal(extractEventTime('Fiesta 19.09'), null);
  assert.equal(extractEventTime('Puertas 22:30 hrs'), '22:30');
});
test('nightlife is not cultural or generic promotion', () => {
  for (const caption of [
    'Evento este domingo',
    'Show de teatro el viernes',
    'Gracias por la fiesta de ayer',
    'ARTISTA CONFIRMADO para fiesta techno 19/09',
    'Taller de cumbia para niños 19/09',
    'Fiesta cancelada 19/09',
  ])
    assert.equal(isLikelyEventPost(caption, '2026-09-19'), false, caption);
  assert.equal(
    isLikelyEventPost('Fiesta techno este sábado. Puertas 23:00. Entrada $5.000', '2026-09-19'),
    true,
  );
});
test('unknown city remains unknown and Reñaca is more specific than Viña', () => {
  assert.equal(inferCity('Santiago'), 'Por confirmar');
  assert.equal(inferCity('Reñaca, Viña del Mar'), 'Reñaca');
});
test('price is admission, not drink offers or conditional free access', () => {
  assert.equal(extractPriceInfo('Piscolas 2x $5.000').known, false);
  assert.equal(extractPriceInfo('Entrada liberada hasta 23:00').known, false);
  assert.equal(extractPriceInfo('Entrada $5.000, cerveza gratis').price, 5000);
  assert.equal(extractPriceInfo('Entrada liberada').known, true);
  assert.equal(extractPriceInfo('Preventa $5.000').price, 5000);
});
