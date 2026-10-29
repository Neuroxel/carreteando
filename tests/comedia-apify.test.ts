import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COMEDIATICKET_API, leerComedyPass, leerComediaTicket, leerTituloComedyPass, pedirComediaTicket } from '../lib/sources/adapters/comedia';
import { runSource } from '../lib/sources/dispatcher';
import { sourceById } from '../lib/sources/registry';
import { decidirCorrida, gastoRegistrado, limitesApify, presupuestoApify } from '../lib/apify-budget';
import { baseMemoria } from './helpers/base-memoria';
import type { Fetcher } from '../lib/sources/types';

// Respuestas reales (recortadas) de las APIs públicas del 17-oct-2026.
const fx = (n: string) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');
const HOY = '2026-10-17';
const pass = () => leerComedyPass(JSON.parse(fx('comedypass-store-regiones-2026-10-17.json')), { id: 'comedypass-regiones' }, HOY);
const ticket = () => leerComediaTicket(JSON.parse(fx('comediaticket-events-2026-10-17.json')), { id: 'comediaticket-region' }, HOY);

test('ComedyPass: fecha y hora del título en hora de Chile; región; precio solo si se puede comprar', () => {
  assert.deepEqual(leerTituloComedyPass('PAOLA MOLINA  17 OCTUBRE 20:00 HRS. BARBONES CURAUMA &#8211; VALPARAISO.', HOY), {
    artista: 'PAOLA MOLINA',
    date: '2026-10-17',
    time: '20:00',
    lugar: 'BARBONES CURAUMA',
    ciudad: 'Valparaíso',
  });
  // Una hora tardía no se corre de día: no hay conversión desde UTC.
  assert.equal(leerTituloComedyPass('X 4 DE NOVIEMBRE 22:30 HRS. TROTAMUNDOS – VALPARAISO', HOY)?.date, '2026-11-04');
  assert.equal(leerTituloComedyPass('X 3 DE ENERO 21:00 HRS. BAR – VALPARAISO', HOY)?.date, '2027-01-03', 'sin año: la próxima vez que cae');
  const r = pass();
  assert.equal(r.parseFailures, 0);
  assert.ok(!r.candidates.some((c) => /osorno/i.test(`${c.city} ${c.venue}`)), 'Osorno no es la región');
  const paola = r.candidates.find((c) => c.title === 'Paola Molina')!;
  assert.deepEqual([paola.date, paola.time, paola.venue, paola.city, paola.priceClp], ['2026-10-17', '20:00', 'Barbones Curauma', 'Valparaíso', null], 'precio de un producto no comprable no se muestra');
  assert.ok(paola.reasons.includes('PRICE_NOT_PURCHASABLE'));
  const vicho = r.candidates.find((c) => c.date === '2026-10-30' && c.title === 'Vicho Viciani')!;
  assert.deepEqual([vicho.priceClp, vicho.priceText], [10000, 'Desde $10.000 en ComedyPass']);
  assert.match(vicho.imageUrl || '', /^https:\/\/comedypass\.online\/wp-content\/uploads\/[^?]+\.webp$/);
  assert.ok(r.candidates.every((c) => !/\d{1,2}:\d{2}/.test(c.title)), 'la hora no va en el título');
});

test('ComediaTicket: una ocurrencia por función; tramo agotado no es precio; fuera de las comunas no entra', () => {
  const r = ticket();
  const carter = r.candidates.filter((c) => /don carter/i.test(c.title));
  assert.equal(carter.length, 2, 'Don Carter 20:00 y 22:00 son dos funciones');
  assert.notEqual(carter[0].key, carter[1].key);
  assert.deepEqual(carter.map((c) => [c.time, c.priceClp, c.priceText]), [
    ['20:00', null, 'Venta cerrada en ComediaTicket'],
    ['22:00', 20000, 'Desde $20.000 en ComediaTicket'],
  ]);
  assert.equal(carter[0].title, carter[1].title, 'mismo título visible, sin la hora');
  const halloween = r.candidates.find((c) => /asskha/i.test(c.title))!;
  assert.equal(halloween.priceClp, 17000, 'el tramo de $15.000 está agotado');
  assert.deepEqual(halloween.tiers?.map((t) => t.agotado), [true, false, false]);
  const carlita = r.candidates.filter((c) => /carlita/i.test(c.title));
  assert.ok(carlita.every((c) => c.priceClp === null && c.disponibilidad === 'agotado'));
  const ciudades = new Set(r.candidates.map((c) => c.city));
  for (const fuera of ['San Felipe', 'Los Andes', 'La Ligua', 'Putaendo', 'Providencia']) assert.ok(!ciudades.has(fuera), fuera);
  assert.ok(r.candidates.every((c) => c.detailUrl?.startsWith('https://www.comediaticket.cl/details/events_details/')));
});

test('ComediaTicket: pagina de 40 en 40 y siempre pide con Country: cl', async () => {
  const pedidas: [string, string | undefined][] = [];
  const lleno = { data: Array.from({ length: 40 }, () => ({})) };
  const fetcher: Fetcher = async (u, init) => {
    pedidas.push([u, init?.headers?.Country]);
    return { status: 200, body: JSON.stringify(u.endsWith('offset=0') ? lleno : { data: [{}] }) };
  };
  const r = await pedirComediaTicket(fetcher);
  assert.equal(r.data.length, 41);
  assert.deepEqual(pedidas, [
    [`${COMEDIATICKET_API}?limit=40&offset=0`, 'cl'],
    [`${COMEDIATICKET_API}?limit=40&offset=40`, 'cl'],
  ]);
});

test('ingesta: las comedias entran a revisión, nunca publicadas solas; Don Carter queda en dos filas', async () => {
  const pagina = fx('comediaticket-events-2026-10-17.json');
  const fetcher: Fetcher = async (u) => (u.startsWith(COMEDIATICKET_API) ? { status: 200, body: pagina } : { status: 404, body: '' });
  const { db, tablas } = baseMemoria();
  const fuente = sourceById('comediaticket-region')!;
  assert.equal(fuente.trust, 'review');
  await runSource(fuente, db, fetcher, HOY);
  assert.ok(tablas.events.length > 0);
  assert.ok(tablas.events.every((e) => e.disposition !== 'public'), 'política inicial: revisión');
  const carter = tablas.events.filter((e) => /don carter/i.test(e.title));
  assert.deepEqual(carter.map((e) => e.event_time).sort(), ['20:00', '22:00']);
  await runSource(fuente, db, fetcher, HOY);
  assert.equal(tablas.events.filter((e) => /don carter/i.test(e.title)).length, 2, 'recargar no duplica');
  assert.equal(sourceById('comedypass-regiones')?.trust, 'review');
});

const limites = limitesApify({});
test('Apify: límites por defecto US$2,50 / US$3,00 / US$0,05 por corrida', () => {
  assert.deepEqual(limites, { soft: 2.5, hard: 3, porCorrida: 0.05 });
  assert.deepEqual(limitesApify({ APIFY_MONTHLY_SOFT_USD: '9', APIFY_MONTHLY_HARD_USD: '3' }).soft, 3, 'el blando nunca supera al duro');
});

test('Apify: nunca se inicia una corrida que pueda pasar el mes de US$3', () => {
  assert.deepEqual(decidirCorrida({ gastadoMes: 1.2, corridasHoy: 3, limites }), { correr: true, maxTotalChargeUsd: 0.05, gastadoMes: 1.2, restante: 1.8 });
  const justo = decidirCorrida({ gastadoMes: 2.96, corridasHoy: 0, limites });
  assert.deepEqual([justo.correr, !justo.correr && justo.motivo], [false, 'APIFY_MONTHLY_BUDGET'], '2,96 + 0,05 > 3');
  assert.equal(decidirCorrida({ gastadoMes: 2.95, corridasHoy: 0, limites }).correr, true, '2,95 + 0,05 = 3 cabe');
  // Pasado el blando: una corrida por día.
  assert.equal(decidirCorrida({ gastadoMes: 2.6, corridasHoy: 0, limites }).correr, true);
  const segunda = decidirCorrida({ gastadoMes: 2.6, corridasHoy: 1, limites });
  assert.equal(!segunda.correr && segunda.motivo, 'APIFY_SOFT_DAILY');
  // Sin saber cuánto se gastó, no se corre.
  const ciega = decidirCorrida({ gastadoMes: null, corridasHoy: 0, limites });
  assert.equal(!ciega.correr && ciega.motivo, 'APIFY_BUDGET_UNKNOWN');
  // El piloto pide su tope de cohorte; manda el menor.
  const piloto = decidirCorrida({ gastadoMes: 0, corridasHoy: 0, limites, topePedido: 0.5 });
  assert.equal(piloto.correr && piloto.maxTotalChargeUsd, 0.05);
});

test('Apify: la contabilidad suma ingesta y piloto del mes UTC; sin costo cuenta como el tope', async () => {
  const ahora = new Date('2026-10-17T18:00:00Z');
  const { db } = baseMemoria({
    ingestion_runs: [
      { started_at: '2026-09-30T23:00:00Z', apify_run_id: 'viejo', cost_usd: 0.9 },
      { started_at: '2026-10-02T18:00:00Z', apify_run_id: 'a', cost_usd: 0.04 },
      { started_at: '2026-10-17T06:00:00Z', apify_run_id: 'b', cost_usd: null },
      { started_at: '2026-10-17T12:00:00Z', apify_run_id: null, cost_usd: 0 },
    ],
    instagram_pilot_runs: [
      { created_at: '2026-10-10T20:00:00Z', apify_run_id: 'p1', summary: { cost_usd: 0.31, cap_usd: 0.5 } },
      { created_at: '2026-10-11T20:00:00Z', apify_run_id: 'p2', summary: { cap_usd: 0.25, error: 'APIFY_TIMEOUT' } },
    ],
  });
  assert.deepEqual(await gastoRegistrado(db, ahora, 0.05), { gastadoMes: 0.65, corridasHoy: 1 });
  // Apify informa más que la base (corrida lanzada fuera de la app): manda el mayor.
  const fetcher = (async () => new Response(JSON.stringify({ data: { current: { monthlyUsageUsd: 2.99 } } }))) as typeof fetch;
  const d = await presupuestoApify(db, { token: 't', ahora, env: {}, fetcher });
  assert.deepEqual([d.correr, d.gastadoMes, !d.correr && d.motivo], [false, 2.99, 'APIFY_MONTHLY_BUDGET']);
  // Base ilegible: falla cerrado.
  const rota = { from: () => ({ select: () => ({ gte: () => ({ not: () => ({ limit: async () => ({ data: null, error: { message: 'x' } }) }), limit: async () => ({ data: null, error: { message: 'x' } }) }) }) }) };
  const r = await presupuestoApify(rota, { ahora, env: {} });
  assert.equal(!r.correr && r.motivo, 'APIFY_BUDGET_UNKNOWN');
});

test('Apify: consumo remoto desconocido impide correr', async () => {
  const { db } = baseMemoria({ ingestion_runs: [], instagram_pilot_runs: [] });
  const decision = await presupuestoApify(db, { token: 't', env: {}, fetcher: async () => new Response('', { status: 503 }) });
  assert.equal(!decision.correr && decision.motivo, 'APIFY_BUDGET_UNKNOWN');
});

test('Apify: límite autorizado es máximo incluso si entorno lo eleva', () => {
  assert.equal(limitesApify({ APIFY_MONTHLY_HARD_USD: '9' }).hard, 3);
  assert.equal(limitesApify({ APIFY_MONTHLY_HARD_USD: '1' }).hard, 1);
});

test('Apify: null, cadena vacía y tipos inválidos no son gasto cero', async () => {
  const { db } = baseMemoria({ ingestion_runs: [], instagram_pilot_runs: [] });
  for (const raw of [null, '', '  ', false, [], {}]) {
    const decision = await presupuestoApify(db, { token: 't', env: {}, fetcher: async () => new Response(JSON.stringify({ data: { current: { monthlyUsageUsd: raw } } })) });
    assert.equal(!decision.correr && decision.motivo, 'APIFY_BUDGET_UNKNOWN');
  }
});
