import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fechaDeLaNoche } from '../lib/event-extraction';

const sql = readFileSync(new URL('../supabase/migrations/20261025055631_corte_noche_sweep_y_disposicion.sql', import.meta.url), 'utf8');
const NOCHE = "to_char(timezone('America/Santiago', now()) - interval '5 hours', 'YYYY-MM-DD')";

test('corte de noche: 00:00 y 04:59 del domingo siguen siendo el sábado; 05:00 ya es domingo', () => {
  // Chile en horario de verano (UTC-3) el 25-oct-2026.
  assert.equal(fechaDeLaNoche(new Date('2026-10-25T03:00:00Z')), '2026-10-24', '00:00');
  assert.equal(fechaDeLaNoche(new Date('2026-10-25T04:15:00Z')), '2026-10-24', '01:15, hora del barrido diario');
  assert.equal(fechaDeLaNoche(new Date('2026-10-25T07:59:00Z')), '2026-10-24', '04:59');
  assert.equal(fechaDeLaNoche(new Date('2026-10-25T08:00:00Z')), '2026-10-25', '05:00');
});
test('migración: barrido y disposición usan la fecha de la noche (−5 h en Chile), no medianoche', () => {
  const barrido = sql.slice(sql.indexOf('FUNCTION public.sweep_stale_events'), sql.indexOf('FUNCTION public.set_event_disposition'));
  const disposicion = sql.slice(sql.indexOf('FUNCTION public.set_event_disposition'));
  assert.ok(barrido.includes(`hoy text := ${NOCHE}`));
  assert.ok(disposicion.includes(`NEW.date_text < ${NOCHE} THEN 'expired'`));
  assert.doesNotMatch(sql, /timezone\('America\/Santiago', now\(\)\)\s*,\s*'YYYY-MM-DD'|current_date/i, 'ningún corte a medianoche');
});
test('migración: sólo las dos funciones; sin recuperación de filas ni historia de 20261018', () => {
  assert.doesNotMatch(sql, /supabase_migrations|schema_migrations|POLICY|recent_events/i);
  assert.equal((sql.match(/CREATE OR REPLACE FUNCTION/g) || []).length, 2);
  // La única escritura de filas es el UPDATE propio del barrido (no una recuperación puntual).
  assert.equal((sql.match(/\bupdate public\.events\b/gi) || []).length, 1);
  assert.doesNotMatch(sql, /is_active\s*=\s*true\s*(,|where)/i);
});

test('caché: refrescar lo público invalida también /api/snapshot y lo viejo no dura más de 10 minutos', () => {
  const lib = readFileSync(new URL('../lib/snapshot.ts', import.meta.url), 'utf8');
  const fn = lib.slice(lib.indexOf('export async function refrescarPublico'));
  assert.match(fn, /revalidateTag\(tag\)/);
  assert.match(fn, /revalidatePath\('\/', 'page'\)/);
  assert.match(fn, /revalidatePath\('\/explorar', 'page'\)/);
  assert.match(fn, /revalidatePath\('\/api\/snapshot'\)/);
  const api = readFileSync(new URL('../app/api/snapshot/route.ts', import.meta.url), 'utf8');
  const swr = Number(api.match(/stale-while-revalidate=(\d+)/)?.[1]);
  assert.ok(swr > 0 && swr <= 600, `swr=${swr}`);
});
