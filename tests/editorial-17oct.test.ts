import { test } from 'node:test';
import assert from 'node:assert/strict';
import { editorialRows } from '../lib/editorial-feed';

// Revisión editorial del 17-oct-2026 (17:00 en Chile): seis fichas abiertas en su fuente primaria.
const NUEVAS = [
  'curated-20261017-sabawoo-ley-c-sale',
  'curated-20261017-studio-super-sabado',
  'curated-20261021-studio-noches-m',
  'curated-20261017-competa-atril-azul',
  'curated-20261017-ignacio-socias-municipal',
  'curated-20261017-liberty-payo-grondona',
];

test('las seis filas revisadas el 17-oct entran con su procedencia y su acceso condicional', () => {
  const filas = editorialRows(new Date('2026-10-17T20:00:00Z')).filter((r) => NUEVAS.includes(r.instagram_id));
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
  // Cómpeta: el afiche dice 19:00 y la ficha 18:00. Sigue publicada (fecha, recinto y
  // acceso confirmados) pero con hora desconocida y el conflicto escrito.
  const competa = filas.find((f) => f.instagram_id === 'curated-20261017-competa-atril-azul');
  assert.equal(competa?.event_time, null);
  assert.match(competa?.description || '', /18:00.*19:00/);
  // Liberty: dirección en conflicto (Passline vs catálogo): se explica y no se publica.
  const liberty = filas.find((f) => f.instagram_id === 'curated-20261017-liberty-payo-grondona');
  assert.equal(liberty?.address, null);
  assert.match(liberty?.description || '', /Almirante Barrozo 9.*Almirante Riveros 9/);
  assert.equal(liberty?.price_clp, 3000);
  assert.deepEqual(
    filas.filter((f) => f.instagram_id !== 'curated-20261017-competa-atril-azul').map((f) => f.event_time).sort(),
    ['20:00', '20:00', '22:00', '22:00', '22:30'],
  );
});

test('Evently entra solo por el subdominio exacto del local', () => {
  const hosts = new Set(editorialRows(new Date('2026-10-17T20:00:00Z')).map((r) => new URL(r.instagram_url).hostname));
  for (const h of hosts) if (h.endsWith('evently.cl')) assert.equal(h, 'wooclub.evently.cl');
});
