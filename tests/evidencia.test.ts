import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateEventEvidence,
  independentGroups,
  originGroupOf,
  statusFromText,
  wilsonLower,
  type EventState,
  type Evidence,
} from '../lib/sources/evidence';
import type { TrustTier } from '../lib/sources/types';
import { duplicadosPorFicha, sourceStatsFrom } from '../lib/sources/automation';
import { dueSources, urgencia } from '../lib/sources/dispatcher';
const HOY = '2026-10-02';
const evento = (over: Partial<EventState> = {}): EventState => ({
  id: 1,
  title: 'Fiesta Mil Tambores',
  date: '2026-10-03',
  time: '22:00',
  venue: 'Club Segundo Piso',
  city: 'Valparaíso',
  venueKnown: true,
  disposition: 'review',
  relevance: 'NIGHTLIFE_HIGH',
  humanLocked: false,
  eventStatus: 'scheduled',
  ...over,
});
const ev = (over: Partial<Evidence> = {}, claims: Evidence['claims'] = {}): Evidence => ({
  sourceId: 'portaldisc-segundopiso',
  family: 'TICKET_PLATFORM',
  originGroup: 'portaldisc',
  authority: 'transactional',
  url: 'https://www.portaldisc.com/evento/x',
  retrievedAt: '2026-10-02T14:00:00Z',
  claims: { date: '2026-10-03', start_time: '22:00', venue: 'Club Segundo Piso', date_verified: true, status: 'scheduled', ...claims },
  structured: false,
  active: true,
  ...over,
});
/** Nivel fijo del registro: el mismo para todas las fuentes del test. */
const confianza = (t: 'auto' | 'strict' | 'review') => (): TrustTier => (t === 'auto' ? 'A' : t === 'strict' ? 'B' : 'C');

test('2 de 2 no es 100 %: el límite inferior castiga las muestras chicas', () => {
  assert.ok(wilsonLower(2, 2) < 0.35);
  assert.ok(wilsonLower(25, 25) > 0.86 && wilsonLower(25, 25) < 0.88);
  assert.equal(wilsonLower(0, 0), 0);
});

test('la ticketera confiable con fecha verificada publica sola una noche', () => {
  const r = evaluateEventEvidence(evento(), [ev()], confianza('strict'), HOY);
  assert.equal(r.decision, 'AUTO_PROMOTE_FROM_REVIEW');
  assert.ok(r.supporting.some((s) => s.includes('ticketera')));
});

test('sin fecha verificada, sin historial o de tarde, la ticketera no basta', () => {
  assert.equal(evaluateEventEvidence(evento(), [ev({}, { date_verified: false })], confianza('strict'), HOY).decision, 'REVIEW_INSUFFICIENT');
  assert.equal(evaluateEventEvidence(evento(), [ev()], confianza('review'), HOY).decision, 'REVIEW_INSUFFICIENT');
  assert.equal(evaluateEventEvidence(evento({ time: '16:00' }), [ev({}, { start_time: '16:00' })], confianza('strict'), HOY).decision, 'REVIEW_INSUFFICIENT');
  assert.equal(evaluateEventEvidence(evento({ time: null }), [ev({}, { start_time: null })], confianza('strict'), HOY).decision, 'REVIEW_INSUFFICIENT');
  assert.equal(evaluateEventEvidence(evento({ venueKnown: false }), [ev()], confianza('strict'), HOY).decision, 'REVIEW_INSUFFICIENT');
});

test('el calendario oficial del lugar publica solo; una pista social nunca', () => {
  const oficial = ev({ sourceId: 'pcdv-agenda', originGroup: 'parquecultural.cl', authority: 'first_party', structured: true });
  assert.equal(evaluateEventEvidence(evento(), [oficial], confianza('auto'), HOY).decision, 'AUTO_PROMOTE_FROM_REVIEW');
  const pista = ev({ sourceId: null, originGroup: 'instagram:el.huevo', authority: 'lead' });
  const r = evaluateEventEvidence(evento(), [pista], confianza('auto'), HOY);
  assert.equal(r.decision, 'REVIEW_INSUFFICIENT');
  assert.ok(r.reasons.some((x) => x.includes('redes')));
});

test('dos orígenes independientes confirman aunque ninguno tenga historial; un espejo no suma', () => {
  const local = ev({ sourceId: 'cinzano-agenda', originGroup: 'cinzanooficial.cl', authority: 'first_party' });
  assert.equal(evaluateEventEvidence(evento(), [ev(), local], confianza('review'), HOY).decision, 'AUTO_PROMOTE_FROM_REVIEW');
  const espejo = ev({ sourceId: 'portaldisc-otro', url: 'https://www.portaldisc.com/evento/y' });
  const directorio = ev({ sourceId: 'valpocultura-agenda', originGroup: 'valpocultura.cl', authority: 'directory' });
  assert.equal(independentGroups([ev(), espejo, directorio]), 1);
  assert.equal(evaluateEventEvidence(evento(), [ev(), espejo, directorio], confianza('review'), HOY).decision, 'REVIEW_INSUFFICIENT');
});

test('una fecha que cambió en el origen no se promedia: se retira y la ve una persona', () => {
  // El caso real del 2 de octubre: la ficha curada decía 3-oct 19:00 y la ticketera hoy dice 11-oct 18:00.
  const humana = ev({ sourceId: null, authority: 'human', retrievedAt: '2026-09-20T00:00:00Z' }, { date: '2026-10-03', start_time: '19:00', venue: 'Teatro Mauri SCD' });
  const ticketera = ev({}, { date: '2026-10-11', start_time: '18:00', venue: 'Teatro Mauri SCD' });
  const r = evaluateEventEvidence(
    evento({ disposition: 'public', date: '2026-10-03', time: '19:00', venue: 'Teatro Mauri SCD' }),
    [humana, ticketera],
    confianza('strict'),
    HOY,
  );
  assert.equal(r.decision, 'REVIEW_CONFLICT');
  assert.ok(r.conflicting.some((c) => c.includes('2026-10-11')));
});

test('lugar distinto u hora muy distinta también es contradicción; diferencia menor no', () => {
  assert.equal(evaluateEventEvidence(evento(), [ev({}, { venue: 'Trotamundos Valparaíso' })], confianza('strict'), HOY).decision, 'REVIEW_CONFLICT');
  assert.equal(evaluateEventEvidence(evento(), [ev({}, { start_time: '19:00' })], confianza('strict'), HOY).decision, 'REVIEW_CONFLICT');
  assert.equal(evaluateEventEvidence(evento(), [ev({}, { start_time: '22:30' })], confianza('strict'), HOY).decision, 'AUTO_PROMOTE_FROM_REVIEW');
});

test('una cancelación escrita por quien manda cancela; lo editado por una persona solo se marca', () => {
  assert.equal(evaluateEventEvidence(evento({ disposition: 'public' }), [ev({}, { status: 'cancelled' })], confianza('strict'), HOY).decision, 'AUTO_CANCEL');
  assert.equal(evaluateEventEvidence(evento({ humanLocked: true }), [ev({}, { status: 'cancelled' })], confianza('strict'), HOY).decision, 'REVIEW_CONFLICT');
  assert.equal(evaluateEventEvidence(evento(), [ev({}, { status: 'postponed' })], confianza('strict'), HOY).decision, 'REVIEW_CONFLICT');
  // Un comentario o una pista no cancela nada.
  const pista = ev({ authority: 'lead', originGroup: 'instagram:x' }, { status: 'cancelled' });
  assert.notEqual(evaluateEventEvidence(evento(), [pista], confianza('strict'), HOY).decision, 'AUTO_CANCEL');
});

test('estado leído del texto de la fuente', () => {
  assert.equal(statusFromText('SUSPENDIDO: Fiesta X'), 'cancelled');
  assert.equal(statusFromText('Show cancelado por lluvia'), 'cancelled');
  assert.equal(statusFromText('Nueva fecha: 11 de octubre'), 'postponed');
  assert.equal(statusFromText('Fiesta retro'), 'scheduled');
});

test('lo pasado se vence, lo académico se descarta, lo humano no se toca salvo contradicción crítica', () => {
  // Editado por una persona y una fuente oficial ahora dice otra fecha: se retira, no se corrige solo.
  assert.equal(evaluateEventEvidence(evento({ humanLocked: true, disposition: 'public' }), [ev({}, { date: '2026-10-05' })], confianza('strict'), HOY).decision, 'REVIEW_CONFLICT');
  assert.equal(evaluateEventEvidence(evento({ date: '2026-09-30' }), [ev()], confianza('strict'), HOY).decision, 'AUTO_EXPIRE');
  assert.equal(evaluateEventEvidence(evento({ relevance: 'IRRELEVANT', academic: true, time: '09:30' }), [ev({}, { start_time: '09:30' })], confianza('strict'), HOY).decision, 'AUTO_REJECT');
  // Backtest: una fonda de día aprobada a mano no tiene señal académica y no se bota.
  assert.equal(evaluateEventEvidence(evento({ relevance: 'IRRELEVANT', academic: false, time: '09:00' }), [ev({}, { start_time: '09:00' })], confianza('strict'), HOY).decision, 'REVIEW_INSUFFICIENT');
  assert.equal(evaluateEventEvidence(evento({ humanLocked: true }), [ev()], confianza('strict'), HOY).decision, 'KEEP');
});

test('la precisión se mide contra la ficha humana y no castiga un cambio posterior del origen', () => {
  const humana = ev({ authority: 'human', sourceId: null, retrievedAt: '2026-09-20T00:00:00Z' });
  const antes = ev({ retrievedAt: '2026-09-19T00:00:00Z' });
  const despues = ev({ retrievedAt: '2026-10-02T00:00:00Z' }, { date: '2026-10-11' });
  const confirmaDespues = ev({ retrievedAt: '2026-10-02T00:00:00Z' });
  const stats = sourceStatsFrom(new Map([[1, [humana, antes]], [2, [humana, despues]], [3, [humana, confirmaDespues]]]));
  assert.deepEqual(stats.get('portaldisc'), { reviewed: 2, confirmed: 2, serious: 0 });
  const errorAlMomento = ev({ retrievedAt: '2026-09-20T12:00:00Z' }, { date: '2026-10-04' });
  assert.deepEqual(sourceStatsFrom(new Map([[1, [humana, errorAlMomento]]])).get('portaldisc'), { reviewed: 1, confirmed: 0, serious: 1 });
});

test('el origen agrupa espejos y separa cuentas', () => {
  assert.equal(originGroupOf('https://www.portaldisc.com/evento/x', 'portaldisc-cassot'), 'portaldisc');
  assert.equal(originGroupOf('https://www.instagram.com/el.huevo/', null), 'instagram:el.huevo');
  assert.equal(originGroupOf('https://valpocultura.cl/evento/a', 'valpocultura-agenda'), 'valpocultura.cl');
});

test('una fuente con eventos encima se revisa antes de su turno, sin martillar', () => {
  assert.equal(urgencia(10), 6);
  assert.equal(urgencia(48), 12);
  assert.equal(urgencia(100), null);
  const now = new Date('2026-10-02T15:00:00Z');
  const rows = [
    { id: 'pcdv-agenda', active: true, next_check_at: '2026-10-03T14:00:00Z', last_checked_at: '2026-10-02T05:00:00Z' },
    { id: 'cinzano-agenda', active: true, next_check_at: '2026-10-03T14:00:00Z', last_checked_at: '2026-10-02T13:00:00Z' },
  ];
  const urgentes = new Map([['pcdv-agenda', 6], ['cinzano-agenda', 6]]);
  assert.deepEqual(dueSources(rows, now, 8, urgentes).map((s) => s.id), ['pcdv-agenda']);
});

test('no se publica con evidencia vieja: la fuente tiene que haberlo mostrado en 72 horas', () => {
  const vieja = ev({ retrievedAt: '2026-09-25T14:00:00Z' });
  const r = evaluateEventEvidence(evento(), [vieja], confianza('strict'), HOY, new Date('2026-10-02T15:00:00Z'));
  assert.equal(r.decision, 'REVIEW_INSUFFICIENT');
  assert.ok(r.reasons[0].includes('3 días'));
});

test('una versión anterior reemplazada por la misma fuente no es contradicción', () => {
  const anterior = ev({ active: false, retrievedAt: '2026-09-25T14:00:00Z' }, { date: '2026-10-02' });
  assert.equal(evaluateEventEvidence(evento(), [anterior, ev()], confianza('strict'), HOY).decision, 'AUTO_PROMOTE_FROM_REVIEW');
});

test('la ticketera sin año escrito lo dice como motivo', () => {
  const r = evaluateEventEvidence(evento(), [ev({}, { date_verified: false })], confianza('strict'), HOY);
  assert.ok(r.reasons[0].includes('año'));
});

test('dos filas con la misma ficha: queda la pública o la que coincide con la última fecha', () => {
  const url = 'https://www.portaldisc.com/evento/benjaminwalkerenvina';
  const filas = [
    { id: 1273, disposition: 'review', date_text: '2026-10-09', source_detail_url: url },
    { id: 1301, disposition: 'review', date_text: '2026-10-11', source_detail_url: url },
  ];
  const evid = new Map([
    [1273, [ev({ url, retrievedAt: '2026-09-28T00:00:00Z', active: false }, { date: '2026-10-09' })]],
    [1301, [ev({ url, retrievedAt: '2026-10-02T14:00:00Z' }, { date: '2026-10-11' })]],
  ]);
  assert.deepEqual([...duplicadosPorFicha(filas, evid)], [[1273, 1301]]);
});

test('"previa inscripción" no es una previa', async () => {
  const { clasificar } = await import('../lib/sources/relevance');
  const k = clasificar({ titulo: 'Seminario Derechos Culturales', descripcion: 'Entrada liberada previa inscripción', hora: '09:30' });
  assert.equal(k.relevancia, 'IRRELEVANT');
  assert.equal(k.academico, true);
});

test('el tipo se infiere del texto y las escenas solo aparecen con oferta', async () => {
  const { inferTipo } = await import('../lib/event-types');
  const { escenasConOferta } = await import('../lib/escenas');
  assert.equal(inferTipo('Tocata punk en el puerto'), 'tocata');
  assert.equal(inferTipo('Peña folclórica de octubre'), 'pena');
  assert.equal(inferTipo('Fiesta retro 80-90s'), 'club');
  assert.equal(inferTipo('Camila Moreno: la última luz en concierto'), 'concierto');
  assert.equal(inferTipo('Varieté circense'), 'noche_cultural');
  assert.equal(inferTipo('Alma adentro'), 'main', 'sin señal no se inventa un tipo');
  const base = { id: 'a', descripcion: '', fecha: '2026-10-10', ciudad: 'Valparaíso', precio: 0, categoria: 'otro', fuente: 'editorial', verificado: false, activo: true, created_at: '' } as const;
  const escenas = escenasConOferta([
    { ...base, nombre: 'Tocata punk', tipo: 'tocata' },
    { ...base, id: 'b', nombre: 'Noche de karaoke', tipo: 'bar' },
  ] as never);
  assert.deepEqual(escenas.map((e) => e.slug).sort(), ['en-vivo', 'karaoke', 'under']);
});
