import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fechaDeLaNoche } from '../lib/event-extraction';

const mig = readFileSync(new URL('../supabase/migrations/20261025060325_review_item_corte_noche.sql', import.meta.url), 'utf8');
const prod = readFileSync(new URL('./fixtures/review_item-produccion-2026-10-25.sql', import.meta.url), 'utf8');
const VIEJA = "p_fields->>'date_text' < to_char(timezone('America/Santiago',now()),'YYYY-MM-DD')";
const NUEVA = "p_fields->>'date_text' < to_char(timezone('America/Santiago',now()) - interval '5 hours','YYYY-MM-DD')";

/** Espejo de la guarda: rechaza si la fecha es anterior al corte (Chile − 5 h, igual que fechaDeLaNoche). */
const rechaza = (fecha: string, ahora: Date) => fecha < fechaDeLaNoche(ahora);

test('review_item: a las 02:00 del domingo 25 se puede aprobar la noche del sábado 24', () => {
  assert.equal(rechaza('2026-10-24', new Date('2026-10-25T05:00:00Z')), false, '02:00 Chile');
  assert.equal(rechaza('2026-10-24', new Date('2026-10-25T07:59:00Z')), false, '04:59 Chile');
});
test('review_item: se rechaza una fecha anterior a la noche y, desde las 05:00, también el 24', () => {
  assert.equal(rechaza('2026-10-23', new Date('2026-10-25T05:00:00Z')), true, '23 a las 02:00');
  assert.equal(rechaza('2026-10-24', new Date('2026-10-25T08:00:00Z')), true, '24 a las 05:00');
});
test('review_item: la migración sólo cambia el corte de la guarda; el resto es la definición de producción', () => {
  assert.ok(prod.includes(VIEJA));
  assert.ok(mig.includes(NUEVA));
  assert.ok(!mig.includes(VIEJA));
  const cuerpo = mig.slice(mig.indexOf('CREATE OR REPLACE FUNCTION')).replace(/;\s*$/, '');
  assert.equal(cuerpo.trim(), prod.trim().replace(VIEJA, NUEVA));
  assert.match(cuerpo, /SET search_path TO ''/);
  assert.doesNotMatch(mig, /\bGRANT\b|\bREVOKE\b|SECURITY DEFINER/i);
});
