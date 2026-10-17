import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { precioDeFicha } from '../lib/sources/adapters/portaldisc';
import { FICHA_EVENTLY, preciosEvently } from '../lib/sources/adapters/jsonld';
import { cambiosDinamicos, runSource } from '../lib/sources/dispatcher';
import { ADAPTERS, sourceById } from '../lib/sources/registry';
import { buildCandidate } from '../lib/sources/normalize';
import { baseMemoria } from './helpers/base-memoria';
import type { Fetcher } from '../lib/sources/types';

// Recortes reales de PortalTickets y Evently del 17-oct-2026.
const fx = (n: string) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');
const ficha = (slug: string) => fx(`portaldisc-${slug}.html`);

test('Tchang: el tramo agotado no es el precio vigente; los tramos quedan registrados', () => {
  const p = precioDeFicha(ficha('tchanglanzamientoep'))!;
  assert.deepEqual([p.price, p.text, p.disponibilidad], [5000, 'Desde $5.000 + cargo', 'disponible']);
  assert.deepEqual(
    p.tiers.map((t) => [t.nombre, t.precio, t.agotado]),
    [
      ['Preventa', 3000, true],
      ['Entrada general', 5000, false],
    ],
  );
  // Terror: dos tramos agotados antes del vigente.
  assert.equal(precioDeFicha(ficha('terror-en-valpo-panic-house'))?.price, 5000);
  // Kazuaki: la preventa sigue a la venta.
  assert.equal(precioDeFicha(ficha('kazuakivalparaiso'))?.price, 4000);
});

test('todas las entradas individuales agotadas: se dice agotado, sin precio vigente', () => {
  const agotada = ficha('tchanglanzamientoep').replace('Comprar o Regalar', 'AGOTADA');
  const p = precioDeFicha(agotada)!;
  assert.deepEqual([p.price, p.text, p.disponibilidad], [null, 'Agotado en PortalTickets', 'agotado']);
});

test('PortalTickets sin "+ Cargo" literal también tiene precio', () => {
  const ninfa = precioDeFicha(ficha('primersencilloninfafolkespacioguestro'))!;
  assert.deepEqual([ninfa.price, ninfa.text], [5000, 'Desde $5.000'], 'la entrada gratis para niños no hace gratis la noche');
  const logia = precioDeFicha(ficha('lalogiasesion07'))!;
  assert.deepEqual([logia.price, logia.text], [2500, 'Desde $2.500']);
  assert.equal(precioDeFicha(ficha('pulsotributoapinkfloydenclubsegundopiso'))?.price, 7000, 'la entrada para dos no es individual');
  assert.equal(precioDeFicha(ficha('thevisionmj5region'))?.price, 8000);
});

test('Evently fuera de Woo: misma estructura de tickets, solo en *.evently.cl', async () => {
  const fichas: Record<string, string> = {
    'https://caferock.evently.cl/Tickets-De-Cortesia-Validos-Hasta-Las-23-Hrs-17-10-2026/tickets': 'evently-caferock-cortesia-17-10-2026-tickets.html',
    'https://journalvina.evently.cl/Emana-Tour-2026-en-Journal-Vina-23-10-2026/tickets': 'evently-journalvina-emana-23-10-2026-tickets.html',
  };
  const pedidas: string[] = [];
  const fetcher: Fetcher = async (u) => {
    pedidas.push(u);
    return fichas[u] ? { status: 200, body: fx(fichas[u]) } : { status: 404, body: '' };
  };
  const base = { city: 'Valparaíso', confidence: 'high' as const, reasons: [] };
  const cafe = buildCandidate({ ...base, sourceId: 'evently-region', title: 'Tickets De Cortesía Válidos Hasta Las 23 Hrs', date: '2026-10-17', time: '20:00', detailUrl: 'https://caferock.evently.cl/Tickets-De-Cortesia-Validos-Hasta-Las-23-Hrs-17-10-2026' })!;
  const emana = buildCandidate({ ...base, sourceId: 'evently-region', title: 'Emana Tour 2026 en Journal Viña', date: '2026-10-23', time: '21:00', detailUrl: 'https://journalvina.evently.cl/Emana-Tour-2026-en-Journal-Vina-23-10-2026' })!;
  const otra = buildCandidate({ ...base, sourceId: 'puntoticket-region', title: 'Otra plataforma', date: '2026-10-23', time: '21:00', detailUrl: 'https://www.puntoticket.com/evento-x' })!;
  await preciosEvently([cafe, emana, otra], fetcher);
  assert.equal(cafe.priceClp, 0);
  assert.match(cafe.priceText || '', /sin costo \(Mayores De 21 Años\)/);
  assert.deepEqual([emana.priceClp, emana.priceText], [5000, 'General $5.000 + cargo']);
  assert.equal(otra.priceClp, null, 'otra plataforma no se lee con el lector de Evently');
  assert.ok(pedidas.every((u) => u.includes('.evently.cl/')));
  assert.equal(FICHA_EVENTLY.test('https://app.evently.cl/algo-largo'), false);
});

test('refresco dinámico: misma ficha refresca; persona solo completa; otra fuente no toca', () => {
  const tchang = { id: 1, source_id: null, instagram_url: 'https://www.portaldisc.com/evento/tchanglanzamientoep', source_detail_url: null, price_clp: 3000, price_text: 'Desde $3.000 + cargos' };
  const leida = { detailUrl: 'https://www.portaldisc.com/evento/tchanglanzamientoep', priceClp: 5000, priceText: 'Desde $5.000 + cargo', disponibilidad: 'disponible' as const };
  assert.deepEqual(cambiosDinamicos(tchang, { id: 'portaldisc-barvienes' }, leida, false), { price_clp: 5000, price_text: 'Desde $5.000 + cargo' });
  assert.equal(cambiosDinamicos(tchang, { id: 'portaldisc-barvienes' }, leida, true), null, 'una corrección humana no se pisa');
  assert.deepEqual(cambiosDinamicos({ ...tchang, price_clp: null, price_text: null }, { id: 'x' }, leida, true), { price_clp: 5000, price_text: 'Desde $5.000 + cargo' });
  const agotado = { ...leida, priceClp: null, priceText: 'Agotado en PortalTickets', disponibilidad: 'agotado' as const };
  assert.deepEqual(cambiosDinamicos(tchang, { id: 'x' }, agotado, false), { price_clp: null, price_text: 'Agotado en PortalTickets' });
  const otraFuente = { detailUrl: 'https://otra.cl/evento/tchang', priceClp: 1000, priceText: 'x', disponibilidad: 'disponible' as const };
  assert.equal(cambiosDinamicos(tchang, { id: 'otra' }, otraFuente, false), null);
  // Cinzano: misma fuente, mismo sitio, otra ruta → la URL pasa a la primaria vigente.
  const viejo = { id: 2, source_id: 'cinzano-agenda', instagram_url: 'https://cinzanooficial.cl/cinzano_event/orquesta-cinzano-viernes-23-de-octubre/', source_detail_url: null, price_clp: 10000, price_text: '$10.000' };
  assert.deepEqual(
    cambiosDinamicos(viejo, { id: 'cinzano-agenda' }, { detailUrl: 'https://cinzanooficial.cl/eventos/?event_id=16651', priceClp: 10000, priceText: 'Entrada $10.000 + $1.000 cargo' }, false),
    { price_clp: 10000, price_text: 'Entrada $10.000 + $1.000 cargo', instagram_url: 'https://cinzanooficial.cl/eventos/?event_id=16651', source_detail_url: 'https://cinzanooficial.cl/eventos/?event_id=16651' },
  );
});

test('ingesta: una nueva lectura corrige la fila editorial congelada (Tchang)', async () => {
  const tarjeta =
    '<div class="album"><a href="/evento/tchanglanzamientoep"><img src="https://images.portaldisc.com/eventos/1.jpg"></a>' +
    '<p>TCHANG! LANZAMIENTO EP EN BAR VIENÉS, VIÑA DEL MAR</p><p>Viernes 23 de octubre 2026, 20:00</p><p>Bar Vienés, Viña del Mar</p></div>';
  const fetcher: Fetcher = async (u) =>
    u.includes('/cartelera/') ? { status: 200, body: `<html>PRÓXIMOS EVENTOS ${tarjeta}</html>` } : u.endsWith('tchanglanzamientoep') ? { status: 200, body: ficha('tchanglanzamientoep') } : { status: 404, body: '' };
  const fila = { id: 1, instagram_id: 'curated-x-tchang', title: 'Tchang! + Mala Postura', venue: 'Bar Vienés', date_text: '2026-10-23', event_time: '20:00', instagram_url: 'https://www.portaldisc.com/evento/tchanglanzamientoep', price_clp: 3000, price_text: 'Desde $3.000 + cargos', source: 'editorial', disposition: 'public' };
  const { db, tablas } = baseMemoria({ events: [{ ...fila }] });
  const r = await runSource(sourceById('portaldisc-barvienes')!, db, fetcher, '2026-10-20');
  assert.equal(r.refreshed, 1);
  assert.deepEqual([tablas.events.length, tablas.events[0].price_clp, tablas.events[0].price_text], [1, 5000, 'Desde $5.000 + cargo']);
  assert.equal(tablas.events[0].title, 'Tchang! + Mala Postura', 'título y procedencia no se tocan');
  // Con una corrección humana registrada, el precio puesto por la persona se respeta.
  const conPersona = baseMemoria({ events: [{ ...fila }], review_audit: [{ target: 'event:1', actor: 'owner' }] });
  await runSource(sourceById('portaldisc-barvienes')!, conPersona.db, fetcher, '2026-10-20');
  assert.equal(conPersona.tablas.events[0].price_clp, 3000);
});

test('ingesta: Cinzano reconcilia la fila vieja de WordPress sin duplicarla', async () => {
  const api = fx('cinzano-api-events-2026-10-17.json');
  const { db, tablas } = baseMemoria({
    events: [
      { id: 5, instagram_id: 'src-cinzano-agenda-2026-10-23-orquesta-cinzano-viernes-23-de-octubre', source_id: 'cinzano-agenda', title: 'Orquesta Cinzano – Viernes 23 de octubre', venue: 'Bar Cinzano', date_text: '2026-10-23', event_time: '21:30', instagram_url: 'https://cinzanooficial.cl/cinzano_event/orquesta-cinzano-viernes-23-de-octubre/', price_clp: 10000, price_text: '$10.000', disposition: 'public' },
    ],
  });
  await runSource(sourceById('cinzano-agenda')!, db, async () => ({ status: 200, body: api }), '2026-10-17');
  const del23 = tablas.events.filter((e) => e.date_text === '2026-10-23');
  assert.equal(del23.length, 1, 'no se duplica');
  assert.equal(del23[0].instagram_url, 'https://cinzanooficial.cl/eventos/?event_id=16651');
  assert.equal(del23[0].price_text, 'Entrada $10.000 + $1.000 cargo');
});

test('Cinzano: event_id es la identidad; /eventos/ no es una sola ficha', () => {
  const ficha = (id: number) => `https://cinzanooficial.cl/eventos/?event_id=${id}`;
  const fila = { id: 9, source_id: 'cinzano-agenda', instagram_url: ficha(16651), source_detail_url: ficha(16651), price_clp: 10000, price_text: 'Entrada $10.000 + $1.000 cargo' };
  const otro = { detailUrl: ficha(16654), priceClp: 12000, priceText: 'Entrada $12.000', disponibilidad: 'disponible' as const };
  assert.equal(cambiosDinamicos(fila, { id: 'cinzano-agenda' }, otro, false), null, 'otro event_id: ni refresca ni migra la URL');
  // La misma ficha con parámetros de seguimiento o en otro orden sí es la misma.
  const mismo = { ...otro, detailUrl: `${ficha(16651)}&utm_source=ig` };
  assert.deepEqual(cambiosDinamicos(fila, { id: 'cinzano-agenda' }, mismo, false), { price_clp: 12000, price_text: 'Entrada $12.000' });
  // La ruta errónea /evento/ID migra a la ficha primaria.
  const errada = { ...fila, instagram_url: 'https://cinzanooficial.cl/evento/16651', source_detail_url: 'https://cinzanooficial.cl/evento/16651' };
  assert.deepEqual(cambiosDinamicos(errada, { id: 'cinzano-agenda' }, { detailUrl: ficha(16651), priceClp: 10000, priceText: 'Entrada $10.000 + $1.000 cargo', disponibilidad: 'disponible' }, false), {
    instagram_url: ficha(16651),
    source_detail_url: ficha(16651),
  });
  // Conflicto de disponibilidad: se retira el precio guardado; una corrección humana no se pisa.
  const conflicto = { detailUrl: ficha(16651), priceClp: null, priceText: null, disponibilidad: 'conflicto' as const };
  assert.deepEqual(cambiosDinamicos(fila, { id: 'cinzano-agenda' }, conflicto, false), { price_clp: null, price_text: null });
  assert.equal(cambiosDinamicos(fila, { id: 'cinzano-agenda' }, conflicto, true), null);
});

test('TicketPlus y Cinzano quedan en revisión (nivel C) hasta aprobación humana', async () => {
  for (const id of ['ticketplus-region', 'cinzano-agenda']) {
    const s = sourceById(id)!;
    assert.deepEqual([s.trust, s.tier], ['review', 'C'], id);
  }
  // Ni una fila nueva de Cinzano se publica sola, tenga o no conflicto.
  const { db, tablas } = baseMemoria();
  await runSource(sourceById('cinzano-agenda')!, db, async () => ({ status: 200, body: fx('cinzano-api-events-2026-10-17.json') }), '2026-10-17');
  assert.ok(tablas.events.length >= 4);
  assert.ok(tablas.events.every((e) => e.disposition !== 'public'));
  const kitsch = tablas.events.find((e) => e.date_text === '2026-10-17')!;
  assert.deepEqual([kitsch.price_clp ?? null, kitsch.price_text ?? null], [null, null], 'sin precio arbitrario');
});

test('Cinzano: el ticket vendible más barato manda sobre el listado; lectura acotada', async () => {
  const API = 'https://cinzanooficial.cl/cinzano-api/cinzano/v1/events';
  const pedidas: string[] = [];
  const fetcher: Fetcher = async (u) => {
    pedidas.push(u);
    if (u === API) return { status: 200, body: fx('cinzano-api-events-2026-10-17.json') };
    const id = /\/events\/(\d+)\/tickets$/.exec(u)?.[1];
    try {
      return { status: 200, body: fx(`cinzano-tickets-${id}-2026-10-17.json`) };
    } catch {
      return { status: 404, body: '' };
    }
  };
  const fuente = sourceById('cinzano-agenda')!;
  const res = await ADAPTERS[fuente.adapter].run(fuente, fetcher);
  const por = (d: string) => res.candidates.find((c) => c.date === d)!;
  // 23-oct: el listado dice $10.000; el ticket dice invitación gratuita hasta las 23:00.
  assert.deepEqual([por('2026-10-23').priceClp, por('2026-10-23').priceText], [0, 'Invitacion gratuita hasta las 23:00 · Entrada despues de las 23:00 $10.000 + $1.000 cargo']);
  // 24-oct: entrada general vendible.
  assert.deepEqual([por('2026-10-24').priceClp, por('2026-10-24').priceText, por('2026-10-24').disponibilidad], [10000, 'Entrada General $10.000 + $1.000 cargo', 'disponible']);
  // 17-oct: la única invitación está agotada (no hay "general $15.000").
  assert.deepEqual([por('2026-10-17').priceClp, por('2026-10-17').priceText, por('2026-10-17').disponibilidad], [null, 'Agotado en Cinzano', 'agotado']);
  // 30-oct: sin tickets: conflicto, sin precio.
  assert.deepEqual([por('2026-10-30').priceClp, por('2026-10-30').disponibilidad], [null, 'conflicto']);
  // 31-oct sin ficha de tickets legible: queda lo del listado.
  assert.equal(por('2026-10-31').priceText, 'Entrada $10.000 + $1.000 cargo');
  assert.ok(pedidas.every((u) => u.startsWith(API)), 'solo la API oficial');
  assert.ok(pedidas.length <= 1 + 8, 'una solicitud por evento, con tope');
});
