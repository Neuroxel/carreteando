import assert from 'node:assert/strict';
import test from 'node:test';
import { portaldiscCartelera } from '../lib/sources/adapters/portaldisc';
import { wpDatedSlug, wpEventsList, wpNewsScan } from '../lib/sources/adapters/wordpress';
import { TOLERANCIA_RELOJ_MS, decide, dueSources, horizonDays, looksLikeSameEvent, normalizedTitle } from '../lib/sources/dispatcher';
import { candidateKey, parseCompactDate, parseSpanishDate, parseTime, validCalendarDate } from '../lib/sources/normalize';
import { SOURCES, ADAPTERS } from '../lib/sources/registry';
import type { EventCandidate, Fetcher, SourceDefinition } from '../lib/sources/types';
const HOY = '2026-09-15';
const fuenteOficial: SourceDefinition = {
  id: 'prueba-oficial',
  name: 'Lugar de prueba',
  sourceType: 'OFFICIAL_VENUE_CALENDAR',
  adapter: 'wp-events-list',
  publicUrl: 'https://ejemplo.cl',
  commune: 'Valparaíso',
  venueSlug: 'lugar-de-prueba',
  venueName: 'Lugar de prueba',
  trust: 'auto',
  refreshHours: 24,
  config: { postType: 'events_list' },
};
const candidato = (over: Partial<EventCandidate> = {}): EventCandidate => ({
  key: 'k',
  title: 'Noche de cumbia en el lugar',
  date: '2026-09-19',
  time: '23:00',
  venue: 'Lugar de prueba',
  city: 'Valparaíso',
  detailUrl: 'https://ejemplo.cl/evento',
  imageUrl: null,
  description: null,
  priceText: null,
  priceClp: null,
  confidence: 'high',
  reasons: [],
  ...over,
});
const responder = (body: string, status = 200): Fetcher => async () => ({ status, body });

test('cada fuente del registro apunta a un adaptador que existe', () => {
  for (const source of SOURCES) {
    assert.ok(ADAPTERS[source.adapter], `${source.id} usa un adaptador inexistente`);
    assert.ok(source.publicUrl.startsWith('https://'), `${source.id} no es https`);
    assert.ok(source.refreshHours >= 24, `${source.id} pediría más de una visita diaria`);
    if (source.trust === 'auto')
      assert.ok(source.venueSlug, `${source.id} publica sin declarar de qué lugar habla`);
  }
  assert.ok(new Set(SOURCES.map((s) => s.id)).size === SOURCES.length, 'hay ids repetidos');
});

test('solo publica sin revisión una fuente oficial con fecha estructurada', () => {
  assert.equal(decide(candidato(), fuenteOficial, HOY).decision, 'publicar');
  assert.equal(decide(candidato({ confidence: 'medium' }), fuenteOficial, HOY).decision, 'revisar');
  assert.equal(
    decide(candidato(), { ...fuenteOficial, trust: 'review' }, HOY).decision,
    'revisar',
    'una ticketera no publica sola',
  );
  assert.equal(
    decide(candidato(), { ...fuenteOficial, venueSlug: null }, HOY).decision,
    'revisar',
    'sin lugar conocido no se publica',
  );
});

test('una exposición de 10:00 no entra sola a la cartelera', () => {
  // Fecha correcta, fuente oficial, lugar conocido: y aun así no es salir de noche.
  const dia = decide(candidato({ time: '10:00' }), fuenteOficial, HOY);
  assert.equal(dia.decision, 'revisar');
  assert.match(dia.reason, /diurno/);
  assert.equal(decide(candidato({ time: null }), fuenteOficial, HOY).decision, 'publicar');
  assert.equal(decide(candidato({ time: '23:30' }), fuenteOficial, HOY).decision, 'publicar');
});

test('una fecha lejana leída de un texto débil se descarta', () => {
  // "Sábado 29 de agosto" sin año, en una nota vieja, se proyectaba al año siguiente.
  assert.equal(decide(candidato({ date: '2027-08-29', confidence: 'medium' }), fuenteOficial, HOY).decision, 'descartado');
  assert.equal(decide(candidato({ date: '2027-08-29', confidence: 'high' }), fuenteOficial, HOY).decision, 'publicar');
  assert.equal(decide(candidato({ date: '2026-09-14' }), fuenteOficial, HOY).decision, 'descartado');
  assert.equal(horizonDays(HOY, '2026-09-19'), 4);
});

test('fechas y horas en castellano', () => {
  assert.equal(parseSpanishDate('Sábado 17 de octubre 2026, 23:30', HOY), '2026-10-17');
  assert.equal(parseSpanishDate('Jueves 18 de septiembre', HOY), '2026-09-18');
  // Sin año y ya pasado, la próxima ocurrencia es el año siguiente.
  assert.equal(parseSpanishDate('14 de agosto', HOY), '2027-08-14');
  assert.equal(parseSpanishDate('sin fecha alguna', HOY), null);
  assert.equal(parseSpanishDate('31 de febrero 2026', HOY), null, 'el 31 de febrero no existe');
  assert.equal(parseCompactDate('20260926'), '2026-09-26');
  assert.equal(parseCompactDate('2026-09-26'), null);
  assert.equal(parseTime('Sábado, 23:30'), '23:30');
  assert.equal(parseTime('19.00 hrs'), '19:00');
  assert.equal(parseTime('sin hora'), null);
  assert.equal(validCalendarDate('2026-02-29'), false);
  assert.equal(validCalendarDate('2028-02-29'), true);
});

test('dos listados de la misma noche se reconocen', () => {
  assert.equal(looksLikeSameEvent('Adiós mundo cruel', 'ADIOS MUNDO CRUEL EN EL PARQUE CULTURAL'), true);
  assert.equal(looksLikeSameEvent('Orquesta Cinzano', 'Karaoke en Subida Ecuador'), false);
  assert.equal(normalizedTitle('Bésame  MACHO!'), 'besame macho');
});

test('la clave de un candidato es estable y separa lugares', () => {
  assert.equal(candidateKey('s1', '2026-09-19', 'Noche X'), candidateKey('s1', '2026-09-19', 'Noche X'));
  assert.notEqual(candidateKey('s1', '2026-09-19', 'Noche X'), candidateKey('s2', '2026-09-19', 'Noche X'));
  assert.notEqual(candidateKey('s1', '2026-09-19', 'Noche X'), candidateKey('s1', '2026-09-20', 'Noche X'));
});

test('el adaptador de agenda oficial lee la fecha estructurada', async () => {
  const body = JSON.stringify([
    {
      slug: 'besame-macho',
      link: 'https://ejemplo.cl/eventos/besame-macho',
      title: { rendered: 'B&#233;same macho' },
      meta: { fecha_de_inicio: '20260926', fecha_de_termino: '20260926', hora_de_inicio: '19:00:00', extracto_corto: 'Entrada liberada' },
    },
    { slug: 'sin-fecha', title: { rendered: 'Sin fecha' }, meta: {} },
  ]);
  const result = await wpEventsList.run(fuenteOficial, responder(body));
  assert.equal(result.itemsFound, 2);
  assert.equal(result.parseFailures, 1);
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].date, '2026-09-26');
  assert.equal(result.candidates[0].time, '19:00');
  assert.equal(result.candidates[0].title, 'Bésame macho');
  assert.equal(result.candidates[0].confidence, 'high');
});

test('el adaptador de slug fechado confía más cuando título y enlace coinciden', async () => {
  const body = JSON.stringify([
    { slug: 'orquesta-2026-09-17', link: 'https://ejemplo.cl/a', title: { rendered: 'Orquesta – Jueves 17 de septiembre' } },
    { slug: 'sin-fecha', link: 'https://ejemplo.cl/b', title: { rendered: 'Orquesta – Viernes 25 de septiembre' } },
  ]);
  const result = await wpDatedSlug.run(fuenteOficial, responder(body));
  assert.equal(result.candidates.length, 2);
  assert.equal(result.candidates[0].confidence, 'high');
  assert.equal(result.candidates[1].confidence, 'medium');
});

test('los comunicados municipales solo aportan lo que menciona la noche', async () => {
  const body = JSON.stringify([
    { link: 'https://muni.cl/a', title: { rendered: 'Licitación de veredas' }, content: { rendered: 'Obras el 20 de septiembre' } },
    { link: 'https://muni.cl/b', title: { rendered: 'Fonda oficial' }, content: { rendered: 'La fonda parte el 18 de septiembre a las 20:00' } },
  ]);
  const result = await wpNewsScan.run({ ...fuenteOficial, trust: 'review' }, responder(body));
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].confidence, 'low');
  assert.equal(result.candidates[0].date, '2026-09-18');
});

test('la cartelera de la ticketera no pierde el único evento de la página', async () => {
  // Con un solo evento, la versión anterior devolvía cero.
  const card = (slug: string, titulo: string, cuando: string) =>
    `class="album"><div class="cover"><a href="/evento/${slug}"><img src="https://images.portaldisc.com/eventos/1.jpg" /></a></div><div class="info_responsivo"><a href="/evento/${slug}"><p>${titulo}</p><p style="font-weight: normal">${cuando}</p><p style="font-weight: normal">Cassot Bar, Valparaíso</p></a></div></div>`;
  const uno = `<h3>PRÓXIMOS EVENTOS EN CASSOT BAR</h3>${card('a', 'SHADOW DANCE', 'Sábado 17 de octubre 2026, 23:30')}`;
  const result = await portaldiscCartelera.run({ ...fuenteOficial, trust: 'review' }, responder(uno));
  assert.equal(result.itemsFound, 1);
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].date, '2026-10-17');
  assert.equal(result.candidates[0].time, '23:30');
  assert.equal(result.candidates[0].imageUrl, 'https://images.portaldisc.com/eventos/1.jpg');
  const dos = `<h3>PRÓXIMOS EVENTOS EN CASSOT BAR</h3>${card('a', 'PRIMERA NOCHE', 'Sábado 17 de octubre 2026, 23:30')}${card('b', 'SEGUNDA NOCHE', 'Domingo 18 de octubre 2026, 22:00')}`;
  const result2 = await portaldiscCartelera.run({ ...fuenteOficial, trust: 'review' }, responder(dos));
  assert.equal(result2.candidates.length, 2);
});

test('una página que cambió de forma falla fuerte en vez de inventar', async () => {
  await assert.rejects(
    () => portaldiscCartelera.run({ ...fuenteOficial, trust: 'review' }, responder('<html>otra cosa</html>')),
    /PAGINA_INESPERADA/,
  );
  await assert.rejects(
    () => wpEventsList.run(fuenteOficial, responder('', 503)),
    /HTTP_503/,
  );
  await assert.rejects(() => wpEventsList.run(fuenteOficial, responder('no es json')), /JSON_INVALIDO/);
  await assert.rejects(() => wpEventsList.run(fuenteOficial, responder('{"a":1}')), /RESPUESTA_INESPERADA/);
});

test('una fuente recién registrada sí entra en el primer despacho', () => {
  // El fallo real de producción: la base estampa next_check_at con su reloj,
  // milisegundos por delante del reloj que el despachador leyó antes de escribir,
  // y las ocho fuentes quedaban "vencidas en el futuro".
  const ahora = new Date('2026-09-15T16:12:05.700Z');
  const recienCreadas = SOURCES.map((s) => ({
    id: s.id,
    active: true,
    next_check_at: '2026-09-15T16:12:05.813Z',
  }));
  assert.equal(dueSources(recienCreadas, ahora, 6).length, 6, 'ninguna fuente se despachó');
});

test('la tolerancia de reloj no adelanta una fuente de verdad futura', () => {
  const ahora = new Date('2026-09-15T16:00:00.000Z');
  const enDosHoras = [{ id: SOURCES[0].id, active: true, next_check_at: '2026-09-15T18:00:00.000Z' }];
  assert.equal(dueSources(enDosHoras, ahora, 6).length, 0);
  const enMedioMinuto = [{ id: SOURCES[0].id, active: true, next_check_at: '2026-09-15T16:00:30.000Z' }];
  assert.equal(dueSources(enMedioMinuto, ahora, 6).length, 1, 'medio minuto entra en la tolerancia');
  assert.equal(TOLERANCIA_RELOJ_MS, 60_000);
});

test('una fuente pausada nunca se despacha y el presupuesto se respeta', () => {
  const vencidas = SOURCES.map((s) => ({ id: s.id, active: s.id !== 'muni-valparaiso', next_check_at: '2026-01-01T00:00:00.000Z' }));
  const despachadas = dueSources(vencidas, new Date('2026-09-15T16:00:00Z'), 3);
  assert.equal(despachadas.length, 3, 'el presupuesto por pasada acota el trabajo');
  assert.equal(dueSources(vencidas, new Date('2026-09-15T16:00:00Z'), 99).some((s) => s.id === 'muni-valparaiso'), false);
});
