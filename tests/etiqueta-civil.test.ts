import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { eventDateLabel, porFechaYHora } from '../lib/events';
import { fechaDeLaNoche } from '../lib/event-extraction';
import { ahoraEnChile, esMadrugada } from '../lib/temporal';

const chile = (iso: string) => new Date(`${iso}-03:00`);
const etiqueta = (fecha: string, ahora: Date) => eventDateLabel(fecha, fechaDeLaNoche(ahora), esMadrugada(ahoraEnChile(ahora)));

test('etiqueta civil: a la 01:00 del 29, un evento del 29 a las 18:00 es "Hoy" (no "Mañana")', () => {
  const ahora = chile('2026-10-29T01:00:00');
  assert.equal(etiqueta('2026-10-28', ahora), 'Esta noche', 'la noche en curso sigue agrupada');
  assert.equal(etiqueta('2026-10-29', ahora), 'Hoy');
  assert.equal(etiqueta('2026-10-30', ahora), 'Mañana');
  assert.match(etiqueta('2026-10-31', ahora), /31/);
});
test('etiqueta civil: de día no cambia nada', () => {
  const ahora = chile('2026-10-29T15:00:00');
  assert.equal(etiqueta('2026-10-29', ahora), 'Hoy');
  assert.equal(etiqueta('2026-10-30', ahora), 'Mañana');
  // 04:59 sigue siendo madrugada; 05:00 ya es el día nuevo.
  assert.equal(etiqueta('2026-10-30', chile('2026-10-30T04:59:00')), 'Hoy');
  assert.equal(etiqueta('2026-10-30', chile('2026-10-30T05:00:00')), 'Hoy');
  assert.equal(etiqueta('2026-10-29', chile('2026-10-30T04:59:00')), 'Esta noche');
});
test('fichas de lugar y evento pasan la madrugada a la etiqueta', () => {
  for (const f of ['../app/lugar/[slug]/page.tsx', '../app/evento/[id]/page.tsx']) {
    const src = readFileSync(new URL(f, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /eventDateLabel\(e\.fecha, today\)/, f);
    assert.match(src, /eventDateLabel\(e\.fecha, today, madrugada\)/, f);
  }
});
test('próximas funciones: por fecha y hora (15:00 antes que 18:00); 00:30 después de 23:00; sin hora al final, sin inventarla', () => {
  const ev = (nombre: string, fecha: string, hora: string | null) => ({ nombre, fecha, hora });
  const lista = [ev('noche-sin-hora', '2026-10-29', null), ev('18h', '2026-10-29', '18:00'), ev('madrugada', '2026-10-29', '00:30'), ev('15h', '2026-10-29', '15:00'), ev('30-oct', '2026-10-30', '12:00'), ev('23h', '2026-10-29', '23:00')];
  assert.deepEqual(lista.sort(porFechaYHora).map((e) => e.nombre), ['15h', '18h', '23h', 'madrugada', 'noche-sin-hora', '30-oct']);
  const lugar = readFileSync(new URL('../app/lugar/[slug]/page.tsx', import.meta.url), 'utf8');
  assert.match(lugar, /e\.fecha >= today\)\.sort\(porFechaYHora\)/);
});
