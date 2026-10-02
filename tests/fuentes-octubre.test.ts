import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import { portaldiscCartelera } from '../lib/sources/adapters/portaldisc';
import { tribeEvents } from '../lib/sources/adapters/tribe';
import { campusRegional, usmEventos } from '../lib/sources/adapters/usm';
import { decide } from '../lib/sources/dispatcher';
import { fechaVerificada } from '../lib/sources/normalize';
import { MANUAL_SOURCES, SOURCES } from '../lib/sources/registry';
import { clasificar } from '../lib/sources/relevance';
import type { EventCandidate, Fetcher, SourceDefinition } from '../lib/sources/types';
mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-02T15:00:00Z') });
const HOY = '2026-10-02';
const responder = (body: string, status = 200): Fetcher => async () => ({ status, body });
const ticketera: SourceDefinition = {
  id: 'portaldisc-prueba',
  name: 'Lugar · cartelera',
  sourceType: 'TICKET_PLATFORM',
  adapter: 'portaldisc-cartelera',
  publicUrl: 'https://www.portaldisc.com/cartelera/prueba',
  commune: 'Valparaíso',
  venueSlug: 'lugar-prueba',
  venueName: 'Lugar Prueba',
  trust: 'strict',
  family: 'TICKET_PLATFORM',
  tier: 'B',
  refreshHours: 48,
};
const directorio: SourceDefinition = {
  ...ticketera,
  id: 'directorio-prueba',
  sourceType: 'OTHER_PUBLIC_EVENT_SOURCE',
  adapter: 'tribe-events',
  publicUrl: 'https://directorio.cl',
  venueSlug: null,
  venueName: null,
  trust: 'review',
  family: 'PUBLIC_EVENT_DIRECTORY',
  tier: 'C',
  relevanceFilter: true,
};
const candidato = (over: Partial<EventCandidate> = {}): EventCandidate => ({
  key: 'k',
  title: 'Fiesta retro 80-90s',
  date: '2026-10-10',
  time: '22:00',
  venue: 'Lugar Prueba',
  city: 'Valparaíso',
  detailUrl: 'https://www.portaldisc.com/evento/x',
  imageUrl: null,
  description: null,
  priceText: null,
  priceClp: null,
  confidence: 'high',
  reasons: [],
  ...over,
});

test('el clasificador separa la noche de la vida académica', () => {
  assert.equal(clasificar({ titulo: 'Fiesta oficial Mil Tambores', hora: '22:00' }).relevancia, 'NIGHTLIFE_HIGH');
  assert.equal(clasificar({ titulo: 'Tocata punk en el puerto' }).relevancia, 'NIGHTLIFE_HIGH');
  assert.equal(clasificar({ titulo: 'Camila Moreno: la última luz', descripcion: 'concierto', hora: '20:00' }).relevancia, 'CULTURAL_NIGHT');
  assert.equal(clasificar({ titulo: 'Seminario Derechos Culturales', hora: '09:30' }).relevancia, 'IRRELEVANT');
  assert.equal(clasificar({ titulo: 'Presentación Taller de Guitarra', hora: '12:30' }).relevancia, 'IRRELEVANT');
  assert.equal(clasificar({ titulo: 'Ceremonia de titulación', hora: '19:00' }).relevancia, 'IRRELEVANT');
  // Sin señales claras no se decide: va a revisión humana.
  assert.equal(clasificar({ titulo: 'Alma adentro', hora: '20:00' }).relevancia, 'REVIEW');
  // Una peña de día puede valer la pena: no se bota, se revisa.
  assert.equal(clasificar({ titulo: 'Peña folclórica', hora: '13:00' }).relevancia, 'REVIEW');
  // Las razones quedan escritas para el panel.
  assert.ok(clasificar({ titulo: 'Fiesta', hora: '23:00' }).razones.some((r) => r.includes('fiesta')));
});

test('la fecha de la ticketera se lee dos veces antes de confiar', () => {
  assert.equal(fechaVerificada('Sábado 3 de octubre 2026, 22:00', '2026-10-03'), true);
  // Día de la semana que no cae en esa fecha: algo se leyó mal.
  assert.equal(fechaVerificada('Viernes 3 de octubre 2026, 22:00', '2026-10-03'), false);
  // Sin año escrito, la fecha es una suposición nuestra.
  assert.equal(fechaVerificada('Sábado 10 de octubre, 17:00.', '2026-10-10'), false);
  assert.equal(fechaVerificada('Sábado 3 de octubre 2027', '2026-10-03'), false);
});

test('nivel B publica solo noches inequívocas de un local conocido', () => {
  assert.equal(decide(candidato(), ticketera, HOY).decision, 'publicar');
  assert.equal(decide(candidato({ time: '17:43' }), ticketera, HOY).decision, 'revisar');
  assert.equal(decide(candidato({ time: null }), ticketera, HOY).decision, 'revisar');
  assert.equal(decide(candidato({ confidence: 'medium' }), ticketera, HOY).decision, 'revisar');
  assert.equal(decide(candidato(), { ...ticketera, venueSlug: null }, HOY).decision, 'revisar');
  assert.equal(decide(candidato({ date: '2027-03-01' }), ticketera, HOY).decision, 'revisar');
  assert.equal(decide(candidato(), ticketera, HOY, 'IRRELEVANT').decision, 'revisar');
});

test('un directorio nunca publica solo y bota lo claramente ajeno', () => {
  assert.equal(decide(candidato(), directorio, HOY, 'NIGHTLIFE_HIGH').decision, 'revisar');
  assert.equal(decide(candidato(), directorio, HOY, 'IRRELEVANT').decision, 'descartado');
  // Sin filtro de relevancia, lo ajeno no se bota: solo pierde la publicación automática.
  assert.equal(decide(candidato(), { ...ticketera, trust: 'auto' }, HOY, 'IRRELEVANT').decision, 'revisar');
});

test('la ticketera marca alta confianza solo con fecha verificada', async () => {
  const card = (slug: string, cuando: string) =>
    `class="album"><a href="/evento/${slug}"><p>NOCHE ${slug}</p><p>${cuando}</p><p>Lugar, Valparaíso</p></a></div>`;
  const html = `<h3>PRÓXIMOS EVENTOS</h3>${card('a', 'Sábado 31 de octubre 2026, 22:00')}${card('b', 'Sábado 31 de octubre, 22:00')}`;
  const { candidates } = await portaldiscCartelera.run(ticketera, responder(html));
  assert.deepEqual(
    candidates.map((c) => c.confidence),
    ['high', 'medium'],
  );
});

test('el adaptador Tribe lee hora, recinto y costo sin tomar la imagen', async () => {
  const body = JSON.stringify({
    events: [
      {
        url: 'https://directorio.cl/evento/a',
        title: 'Club Segundo Piso &#8211; Fiesta Mil Tambores',
        start_date: '2030-10-03 22:00:00',
        end_date: '2030-10-04 04:00:00',
        all_day: false,
        cost: 'Gratuito',
        categories: [{ name: 'Música' }],
        venue: { venue: 'Club Segundo Piso', city: 'Valparaíso' },
        image: { url: 'https://directorio.cl/captura.png' },
      },
      {
        url: 'https://directorio.cl/evento/b',
        title: 'Muestra de un mes',
        start_date: '2030-09-01 00:00:00',
        end_date: '2030-10-30 23:59:00',
        all_day: true,
        venue: [],
      },
      { title: 'sin fecha', url: 'https://directorio.cl/x' },
    ],
  });
  const { candidates, parseFailures, itemsFound } = await tribeEvents.run(directorio, responder(body));
  assert.equal(itemsFound, 3);
  assert.equal(parseFailures, 1);
  const [fiesta, muestra] = candidates;
  assert.equal(fiesta.title, 'Club Segundo Piso – Fiesta Mil Tambores');
  assert.equal(fiesta.time, '22:00');
  assert.equal(fiesta.venue, 'Club Segundo Piso');
  assert.equal(fiesta.imageUrl, null);
  assert.ok(fiesta.description?.includes('Gratuito'));
  assert.deepEqual(fiesta.categories, ['Música']);
  assert.equal(muestra.time, null, 'todo el día no es una hora');
  assert.equal(muestra.venue, null);
});

test('un calendario Tribe vacío no es una fuente rota; una ruta inexistente sí', async () => {
  const vacio = await tribeEvents.run(directorio, responder('{"code":"rest_no_events"}', 404));
  assert.equal(vacio.candidates.length, 0);
  await assert.rejects(tribeEvents.run(directorio, responder('{"code":"rest_no_route"}', 404)));
});

test('la USM aporta solo campus de la región y nunca lo académico de día', async () => {
  assert.equal(campusRegional('Casa Central Valparaíso'), 'Valparaíso');
  assert.equal(campusRegional('Sede Viña del Mar'), 'Viña del Mar');
  assert.equal(campusRegional('Campus San Joaquín'), null);
  const post = (titulo: string, campus: string, hora: string) => ({
    link: 'https://usm.cl/eventos/x/',
    title: { rendered: titulo },
    acf: {
      datos_evento: { titulo_evento: titulo, fecha_evento: '1917475200', hora_inicio_evento: hora },
      datos_organizador: { campus_sede: campus, modalidad: 'Presencial' },
    },
  });
  const body = JSON.stringify([
    post('Presentación Taller de Guitarra', 'Campus San Joaquín', '12:30:00'),
    post('Concierto de la Orquesta', 'Casa Central Valparaíso', '19:30:00'),
  ]);
  const { candidates } = await usmEventos.run({ ...directorio, adapter: 'usm-eventos' }, responder(body));
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].date, '2030-10-06');
  assert.equal(candidates[0].time, '19:30');
  assert.equal(candidates[0].city, 'Valparaíso');
});

test('cada fuente declara familia y nivel, y lo ruidoso pasa por el clasificador', () => {
  for (const source of SOURCES) {
    assert.ok(source.family, `${source.id} sin familia`);
    assert.ok(source.tier, `${source.id} sin nivel`);
    if (source.tier === 'C' || source.tier === 'D')
      assert.notEqual(source.trust, 'auto', `${source.id} de nivel ${source.tier} no puede publicar solo`);
    if (source.family === 'UNIVERSITY_OFFICIAL' || source.family === 'PUBLIC_EVENT_DIRECTORY')
      assert.ok(source.relevanceFilter, `${source.id} necesita el clasificador`);
  }
  const ids = new Set(SOURCES.map((s) => s.id));
  for (const manual of MANUAL_SOURCES) assert.ok(!ids.has(manual.id), `${manual.id} está repetida`);
  // Ninguna fuente bloqueada se intenta leer con un programa.
  assert.ok(MANUAL_SOURCES.some((s) => s.id === 'uv-agenda' && s.accessMode === 'blocked'));
});
