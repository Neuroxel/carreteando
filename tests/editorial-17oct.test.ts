import { test } from 'node:test';
import assert from 'node:assert/strict';
import { editorialRows } from '../lib/editorial-feed';

// Revisión editorial del 17-oct-2026: cinco fichas abiertas en su fuente primaria.
const NUEVAS = [
  'curated-20261017-sabawoo-ley-c-sale',
  'curated-20261017-studio-super-sabado',
  'curated-20261021-studio-noches-m',
  'curated-20261017-competa-atril-azul',
  'curated-20261017-ignacio-socias-municipal',
];

test('las cinco filas revisadas el 17-oct entran con su procedencia y su acceso condicional', () => {
  const filas = editorialRows(new Date('2026-10-17T15:00:00Z')).filter((r) => NUEVAS.includes(r.instagram_id));
  assert.equal(filas.length, NUEVAS.length);
  for (const f of filas) {
    assert.equal(f.moderation_status, 'approved');
    assert.equal(f.organizer_verified, false);
    assert.ok(f.image_url && f.image_source_url === f.instagram_url);
  }
  // Gratis con condición: el texto visible la dice, nunca "Gratis" a secas.
  const woo = filas.find((f) => f.instagram_id === 'curated-20261017-sabawoo-ley-c-sale');
  assert.equal(woo?.price_clp, 0);
  assert.match(woo?.price_text || '', /hasta 23:30.*\+18.*\+21/);
});

test('Evently entra solo por el subdominio exacto del local', () => {
  const hosts = new Set(editorialRows(new Date('2026-10-17T15:00:00Z')).map((r) => new URL(r.instagram_url).hostname));
  for (const h of hosts) if (h.endsWith('evently.cl')) assert.equal(h, 'wooclub.evently.cl');
});
