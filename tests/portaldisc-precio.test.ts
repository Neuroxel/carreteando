import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { precioDeFicha, portaldiscCartelera } from '../lib/sources/adapters/portaldisc';
mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-17T15:00:00Z') });

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

const fuente = {
  id: 'precio-test', name: 'Precio', sourceType: 'TICKET_PLATFORM', adapter: 'portaldisc-cartelera',
  publicUrl: 'https://www.portaldisc.com/cartelera/prueba', commune: 'Valparaíso',
  venueName: 'Lugar', trust: 'strict', family: 'TICKET_PLATFORM', tier: 'B', refreshHours: 24,
} as const;
const card = (slug: string, day = '17', month = 'octubre') =>
  `class="album"><a href="/evento/${slug}">Ficha</a><p>Noche ${slug}</p><p>${day} de ${month} de 2026 21:00</p><p>Lugar, Valparaíso</p>`;
const cartelera = (...cards: string[]) => `PRÓXIMOS EVENTOS ${cards.join('')}`;

test('recupera una ficha por el alias HTTPS tras error de conexión sin cambiar su procedencia', async () => {
  const llamadas: string[] = [];
  const result = await portaldiscCartelera.run(fuente, async (url) => {
    llamadas.push(url);
    if (url === fuente.publicUrl) return { status: 200, body: cartelera(card('shadowdance3')) };
    if (url.startsWith('https://www.')) throw new Error('ECONNRESET');
    return { status: 200, body: ficha('shadowdance3') };
  });
  assert.deepEqual(llamadas.slice(1), ['https://www.portaldisc.com/evento/shadowdance3', 'https://portaldisc.com/evento/shadowdance3']);
  assert.equal(result.candidates[0].priceClp, 5000);
  assert.equal(result.candidates[0].detailUrl, 'https://www.portaldisc.com/evento/shadowdance3');
  assert.deepEqual(result.diagnostics, []);
});

test('distingue ficha sin precio, fallo HTTP y fallo de red sin descartar eventos', async () => {
  const result = await portaldiscCartelera.run(fuente, async (url) => {
    if (url === fuente.publicUrl) return { status: 200, body: cartelera(card('sinprecio'), card('errorhttp'), card('errorred')) };
    if (url.endsWith('errorred')) throw new Error('ECONNRESET');
    return { status: url.endsWith('errorhttp') ? 503 : 200, body: 'No hay bloque de tickets' };
  });
  assert.equal(result.candidates.length, 3);
  assert.ok(result.candidates.every((c) => c.priceClp === null));
  assert.deepEqual(result.diagnostics, ['PRICE_NOT_FOUND=1', 'PRICE_HTTP_503=1', 'PRICE_NETWORK=1']);
  assert.ok(result.candidates[0].reasons.includes('PRICE_NOT_FOUND'));
});

test('el cupo de 24 fichas prioriza hoy aunque el índice lo deje al final', async () => {
  const llamadas: string[] = [];
  const futuras = Array.from({ length: 24 }, (_, i) => card(`futuro${i}`, '17', 'noviembre'));
  const result = await portaldiscCartelera.run(fuente, async (url) => {
    if (url === fuente.publicUrl) return { status: 200, body: cartelera(...futuras, card('hoy')) };
    llamadas.push(url);
    return { status: 200, body: ficha('shadowdance3') };
  });
  assert.equal(llamadas.length, 24);
  assert.ok(llamadas[0].endsWith('/hoy'));
  assert.equal(result.candidates.find((c) => c.detailUrl.endsWith('/hoy'))?.priceClp, 5000);
  assert.deepEqual(result.diagnostics, ['PRICE_BUDGET=1']);
  assert.equal(result.candidates.filter((c) => c.priceClp === null).length, 1);
});

test('también prueba el alias tras HTTP fallido, pero no lo usa si HTTP 200 carece de precio', async () => {
  const llamadas: string[] = [];
  const result = await portaldiscCartelera.run(fuente, async (url) => {
    llamadas.push(url);
    if (url === fuente.publicUrl) return { status: 200, body: cartelera(card('recuperado'), card('sinprecio')) };
    if (url === 'https://www.portaldisc.com/evento/recuperado') return { status: 502, body: '' };
    return { status: 200, body: url.endsWith('recuperado') ? ficha('shadowdance3') : '' };
  });
  assert.equal(result.candidates[0].priceClp, 5000);
  assert.equal(result.candidates[1].priceClp, null);
  assert.ok(!llamadas.includes('https://portaldisc.com/evento/sinprecio'));
  assert.deepEqual(result.diagnostics, ['PRICE_NOT_FOUND=1']);
});

test('los reintentos también consumen el presupuesto de 24 solicitudes HTTP', async () => {
  const llamadas: string[] = [];
  const futuras = Array.from({ length: 24 }, (_, i) => card(`futuro${i}`, '17', 'noviembre'));
  const result = await portaldiscCartelera.run(fuente, async (url) => {
    if (url === fuente.publicUrl) return { status: 200, body: cartelera(...futuras, card('hoy')) };
    llamadas.push(url);
    if (url.endsWith('/hoy')) return { status: 200, body: ficha('shadowdance3') };
    throw new Error('ECONNRESET');
  });
  assert.equal(llamadas.length, 24);
  assert.ok(llamadas[0].endsWith('/hoy'));
  assert.equal(result.candidates.find((c) => c.detailUrl.endsWith('/hoy'))?.priceClp, 5000);
  const sinReintento = result.candidates.find((c) => c.detailUrl.endsWith('/futuro11'));
  assert.ok(sinReintento?.reasons.includes('PRICE_NETWORK'));
  assert.ok(sinReintento?.reasons.includes('PRICE_BUDGET'));
  assert.deepEqual(result.diagnostics, ['PRICE_NETWORK=12', 'PRICE_BUDGET=13']);
});
