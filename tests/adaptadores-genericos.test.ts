import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import { dtstart, icsCalendar, parseIcs } from '../lib/sources/adapters/ics';
import { ciudadDe, eventosLd, fechaHoraChile, jsonldEvents } from '../lib/sources/adapters/jsonld';
import { venueByName } from '../lib/sources/dispatcher';
import { SOURCES } from '../lib/sources/registry';
import type { Fetcher } from '../lib/sources/types';
mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-02T15:00:00Z') });

const ticketplus = SOURCES.find((s) => s.id === 'ticketplus-region')!;
const baburizza = {
  ...ticketplus,
  id: 'ics-prueba',
  adapter: 'ics-calendar',
  publicUrl: 'https://www.museobaburizza.cl/agenda/',
  venueName: 'Museo Baburizza',
  family: 'CULTURAL_CENTER' as const,
  tier: 'A' as const,
  config: { icsUrl: 'https://www.museobaburizza.cl/agenda/?ical=1' },
};
const pagina = (ev: object) => `<html><script type="application/ld+json">${JSON.stringify(ev)}</script></html>`;
const evento = (over: object = {}) => ({
  '@context': 'https://schema.org',
  '@type': 'Event',
  eventStatus: 'https://schema.org/EventScheduled',
  url: 'https://ticketplus.cl/events/bandalos-chinos-teatro-municipal-vina-del-mar',
  name: 'Bandalos Chinos',
  startDate: '2026-10-17T21:00-03:00',
  location: { '@type': 'Place', name: 'Teatro Municipal de Viña del Mar', address: { addressLocality: 'Viña del Mar', addressRegion: 'Valparaíso' } },
  offers: { '@type': 'AggregateOffer', lowPrice: '15000', priceCurrency: 'CLP' },
  ...over,
});

test('JSON-LD: fecha con zona horaria pasa a hora de Chile', () => {
  assert.deepEqual(fechaHoraChile('2026-10-18T12:00-03:00'), { date: '2026-10-18', time: '12:00' });
  assert.deepEqual(fechaHoraChile('2026-10-18T02:30:00Z'), { date: '2026-10-17', time: '23:30' });
  assert.deepEqual(fechaHoraChile('2026-10-18'), { date: '2026-10-18', time: null });
  assert.equal(ciudadDe('Vina del Mar'), 'Viña del Mar');
  assert.equal(ciudadDe('Pirque'), null);
});

test('JSON-LD: encuentra Event dentro de @graph y listas, e ignora bloques rotos', () => {
  const html = `<script type="application/ld+json">{roto</script><script type="application/ld+json">${JSON.stringify({ '@graph': [{ '@type': 'Organization' }, evento()] })}</script>`;
  assert.equal(eventosLd(html).length, 1);
});

test('JSON-LD por sitemap: solo comunas de la región, como máximo N páginas, y el estado viaja', async () => {
  const sitemap = [
    'https://ticketplus.cl/events/bandalos-chinos-teatro-municipal-vina-del-mar',
    'https://ticketplus.cl/events/fiesta-de-la-primavera-2026',
    'https://ticketplus.cl/events/cancelado-en-quilpue',
    'https://ticketplus.cl/events/otro-en-pirque-vina-falso',
  ]
    .map((u) => `<url><loc>${u}</loc></url>`)
    .join('');
  const pedidas: string[] = [];
  const fetcher: Fetcher = async (url) => {
    pedidas.push(url);
    if (url.endsWith('sitemap.xml')) return { status: 200, body: sitemap };
    if (url.includes('cancelado'))
      return { status: 200, body: pagina(evento({ name: 'Show en Quilpué', eventStatus: 'https://schema.org/EventCancelled', location: { name: 'Teatro Quilpué', address: { addressLocality: 'Quilpué' } } })) };
    if (url.includes('pirque')) return { status: 200, body: pagina(evento({ location: { name: 'Hotel', address: { addressLocality: 'Pirque' } } })) };
    return { status: 200, body: pagina(evento()) };
  };
  const r = await jsonldEvents.run(ticketplus, fetcher);
  assert.ok(!pedidas.some((u) => u.includes('fiesta-de-la-primavera')), 'una URL sin comuna de la región no se abre');
  assert.equal(r.candidates.length, 2, 'el slug decía viña pero el JSON-LD dice Pirque: se descarta');
  const [a, b] = r.candidates;
  assert.equal(a.date, '2026-10-17');
  assert.equal(a.time, '21:00');
  assert.equal(a.city, 'Viña del Mar');
  assert.equal(a.confidence, 'high');
  assert.ok(a.description?.includes('15.000'));
  assert.equal(b.status, 'cancelled');
});

test('ICS: líneas plegadas, fechas de día completo y la hora de pared de The Events Calendar', () => {
  const ics = [
    'BEGIN:VCALENDAR',
    'BEGIN:VEVENT',
    'DTSTART;TZID=UTC:20261011T100000',
    'SUMMARY:Domingo gratis ',
    ' octubre',
    'LOCATION:Museo Baburizza\\, Paseo Yugoslavo 176\\, Valparaíso',
    'URL:https://www.museobaburizza.cl/evento/domingo-gratis/',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'DTSTART;VALUE=DATE:20261019',
    'SUMMARY:Exposición virtual',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  const evs = parseIcs(ics);
  assert.equal(evs.length, 2);
  // RFC 5545: el salto más el espacio inicial se eliminan; el texto se une tal cual.
  assert.equal(evs[0].SUMMARY.value, 'Domingo gratis octubre');
  assert.deepEqual(dtstart(evs[0].DTSTART), { date: '2026-10-11', time: '10:00' });
  assert.deepEqual(dtstart(evs[1].DTSTART), { date: '2026-10-19', time: null });
  assert.deepEqual(dtstart({ value: '20261011T230000Z', params: '' }), { date: '2026-10-11', time: '20:00' });
});

test('ICS: el adaptador lee el calendario y marca cancelados', async () => {
  const ics = [
    'BEGIN:VCALENDAR',
    'BEGIN:VEVENT',
    'DTSTART:20261024T200000',
    'SUMMARY:Noche de museos: concierto en vivo',
    'URL:https://www.museobaburizza.cl/evento/noche/',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'DTSTART:20261025T200000',
    'SUMMARY:Concierto suspendido',
    'STATUS:CANCELLED',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'DTSTART:20250101T200000',
    'SUMMARY:Pasado',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\n');
  const r = await icsCalendar.run(baburizza, async () => ({ status: 200, body: ics }));
  assert.equal(r.itemsFound, 3);
  assert.equal(r.candidates.length, 2);
  assert.equal(r.candidates[0].venue, 'Museo Baburizza');
  assert.equal(r.candidates[0].time, '20:00');
  assert.equal(r.candidates[1].status, 'cancelled');
  await assert.rejects(icsCalendar.run(baburizza, async () => ({ status: 200, body: '<html>' })));
});

test('un local de una ticketera se reconoce por nombre solo si calza de verdad', () => {
  const registro = [
    { id: 1, name: 'Teatro Municipal de Viña del Mar', city: 'Viña del Mar' },
    { id: 2, name: 'Teatro Quilpué', city: 'Quilpué' },
  ];
  assert.equal(venueByName(registro, 'Teatro Municipal de Viña del Mar', 'Viña del Mar'), 1);
  assert.equal(venueByName(registro, 'Teatro Municipal de Viña del Mar - Sala Aldo Francia', 'Viña del Mar'), 1);
  assert.equal(venueByName(registro, 'Teatro', 'Quilpué'), null, 'un nombre corto no basta');
  assert.equal(venueByName(registro, 'Teatro Quilpué', 'Viña del Mar'), 2, 'nombre exacto vale en cualquier ciudad');
  assert.equal(venueByName(registro, null, 'Viña del Mar'), null);
});

test('Evently: comuna desde la dirección, sin confundir la región con la ciudad', async () => {
  const { ciudadEnTexto, fechaDeSlug, enlacesDeListas } = await import('../lib/sources/adapters/jsonld');
  assert.equal(ciudadEnTexto('Av. Borgoño 12041, Viña del Mar, Región de Valparaíso, Chile'), 'Viña del Mar');
  assert.equal(ciudadEnTexto('Blanco 1253, Valparaíso, Región de Valparaíso, Chile'), 'Valparaíso');
  assert.equal(ciudadEnTexto('Estadio Mirasol, Algarrobo, Valparaíso, Chile'), null);
  assert.equal(ciudadEnTexto('Club Patio, La Ligua, Región de Valparaíso'), null);
  assert.equal(ciudadEnTexto('Linderos, Buin, Región Metropolitana'), null);
  assert.equal(fechaDeSlug('https://x.evently.cl/ENDO-EN-LA-LIGUA-CLUB-PATIO-03-10-2026'), '2026-10-03');
  const html = '<a href="https://a.evently.cl/Fiesta-Vina-01-10-2026">x</a><a href="https://b.evently.cl/Show-Santiago-10-10-2026">y</a><a href="https://c.evently.cl/Noche-Valparaiso-10-10-2026">z</a><a href="https://app.evently.cl/sign-in">no</a>';
  const links = enlacesDeListas([html], /^https:\/\/(?!app\.|admin\.)[a-z0-9-]+\.evently\.cl\/[A-Za-z0-9-]{6,}$/, '2026-10-03', 5);
  assert.deepEqual(links, ['https://c.evently.cl/Noche-Valparaiso-10-10-2026', 'https://b.evently.cl/Show-Santiago-10-10-2026']);
});
