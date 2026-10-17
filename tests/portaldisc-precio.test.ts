import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { precioDeFicha } from '../lib/sources/adapters/portaldisc';

// Recortes reales de fichas de PortalTickets del 17-oct-2026 (bloque TICKETS DISPONIBLES).
const ficha = (s: string) => readFileSync(new URL(`./fixtures/portaldisc-${s}.html`, import.meta.url), 'utf8');

test('ticket gratuito con condición: se dice la condición, nunca "Gratis" a secas', () => {
  assert.deepEqual(precioDeFicha(ficha('metalattackenclubsegundopiso')), {
    price: 0,
    text: 'Ticket gratis hasta agotar stock · General $4.000 + cargo',
  });
});

test('la promo de 3 entradas no cuenta como precio individual', () => {
  assert.deepEqual(precioDeFicha(ficha('folkquilpue17deoctubre')), { price: 2500, text: 'Desde $2.500 + cargo' });
});

test('lo agotado o no disponible no cuenta', () => {
  assert.equal(precioDeFicha(ficha('shadowdance3'))?.price, 5000);
  assert.equal(precioDeFicha(ficha('llenode97'))?.price, 6000);
});

test('sin bloque de tickets no se inventa precio', () => {
  assert.equal(precioDeFicha('<html><body>Evento</body></html>'), null);
});
