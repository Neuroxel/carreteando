import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fechaDeLaNoche } from '../lib/event-extraction';
import { filterEvents } from '../lib/events';
import { readEvents } from '../lib/server-events';
import { estadoTemporal, ahoraEnChile } from '../lib/temporal';
import type { Evento } from '../lib/types';

// Octubre en Chile continental: UTC-3. Sábado 17 a las 23:00 = domingo 18 02:00Z.
const chile = (fechaHora: string) => new Date(`${fechaHora}-03:00`);

test('la noche del sábado dura hasta las 05:00 del domingo', () => {
  assert.equal(fechaDeLaNoche(chile('2026-10-17T23:00:00')), '2026-10-17');
  assert.equal(fechaDeLaNoche(chile('2026-10-18T00:30:00')), '2026-10-17', 'pasada la medianoche sigue siendo sábado');
  assert.equal(fechaDeLaNoche(chile('2026-10-18T04:59:00')), '2026-10-17');
  assert.equal(fechaDeLaNoche(chile('2026-10-18T05:00:00')), '2026-10-18', 'a las 05:00 empieza el domingo');
  assert.equal(fechaDeLaNoche(chile('2026-10-18T14:00:00')), '2026-10-18');
});

const ev = (id: string, fecha: string, hora: string | null) =>
  ({ id, nombre: id, fecha, hora, activo: true, ciudad: 'Valparaíso', categoria: 'fiesta', tipo: 'club', lugar: 'X' }) as unknown as Evento;
const lista = [ev('sabado-23', '2026-10-17', '23:00'), ev('sabado-20', '2026-10-17', '20:00'), ev('domingo', '2026-10-18', '21:00'), ev('viernes', '2026-10-16', '23:00')];

test('a las 02:00 del domingo, "Hoy" muestra los eventos del sábado como ya empezados', () => {
  const ahora = chile('2026-10-18T02:00:00');
  const hoy = filterEvents(lista, { fecha: 'hoy' }, fechaDeLaNoche(ahora)).map((e) => e.id).sort();
  assert.deepEqual(hoy, ['sabado-20', 'sabado-23']);
  assert.ok(!filterEvents(lista, { fecha: 'futuro' }, fechaDeLaNoche(ahora)).some((e) => e.id === 'viernes'), 'el viernes ya no vuelve');
  assert.equal(estadoTemporal(lista[0], ahoraEnChile(ahora)), 'iniciado', '"Ya empezó", no "terminó"');
  // A las 05:00 el sábado sale de la cartelera.
  assert.deepEqual(filterEvents(lista, { fecha: 'hoy' }, fechaDeLaNoche(chile('2026-10-18T05:00:00'))).map((e) => e.id), ['domingo']);
});

test('la lectura pública pide desde la fecha de la noche', async (t) => {
  const original = globalThis.fetch;
  const env = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY };
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
  const pedidas: string[] = [];
  globalThis.fetch = (async (u: string) => (pedidas.push(String(u)), new Response('[]', { headers: { 'content-type': 'application/json' } }))) as typeof fetch;
  t.mock.timers.enable({ apis: ['Date'], now: chile('2026-10-18T01:15:00').getTime() });
  try {
    await readEvents();
    assert.match(decodeURIComponent(pedidas[0]), /date_text=gte\.2026-10-17/);
  } finally {
    t.mock.timers.reset();
    globalThis.fetch = original;
    if (env.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = env.url;
    if (env.key === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = env.key;
  }
});

test('la política pública de la base usa el mismo corte de las 05:00', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261018090000_noche_hasta_las_5.sql', import.meta.url), 'utf8');
  assert.match(sql, /CREATE POLICY "Public read"[\s\S]*now\(\)\) - interval '5 hours'/);
  assert.equal((sql.match(/interval '5 hours'/g) || []).length, 2, 'política y vista recent_events');
});
