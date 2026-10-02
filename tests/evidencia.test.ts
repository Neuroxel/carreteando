import assert from 'node:assert/strict';
import test from 'node:test';
import {
  earnTrust,
  evaluateEventEvidence,
  independentGroups,
  originGroupOf,
  statusFromText,
  wilsonLower,
  type EarnedTrust,
  type EventState,
  type Evidence,
} from '../lib/sources/evidence';
import { sourceStatsFrom } from '../lib/sources/automation';
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
const confianza = (t: EarnedTrust) => () => t;

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
  assert.equal(evaluateEventEvidence(evento({ time: '17:43' }), [ev({}, { start_time: '17:43' })], confianza('strict'), HOY).decision, 'REVIEW_INSUFFICIENT');
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

test('lo pasado se vence, lo académico se descarta, lo humano no se toca', () => {
  assert.equal(evaluateEventEvidence(evento({ date: '2026-09-30' }), [ev()], confianza('strict'), HOY).decision, 'AUTO_EXPIRE');
  assert.equal(evaluateEventEvidence(evento({ relevance: 'IRRELEVANT', academic: true, time: '09:30' }), [ev({}, { start_time: '09:30' })], confianza('strict'), HOY).decision, 'AUTO_REJECT');
  // Backtest: una fonda de día aprobada a mano no tiene señal académica y no se bota.
  assert.equal(evaluateEventEvidence(evento({ relevance: 'IRRELEVANT', academic: false, time: '09:00' }), [ev({}, { start_time: '09:00' })], confianza('strict'), HOY).decision, 'REVIEW_INSUFFICIENT');
  assert.equal(evaluateEventEvidence(evento({ humanLocked: true }), [ev()], confianza('strict'), HOY).decision, 'KEEP');
});

test('la confianza sube despacio y baja rápido, con un techo por nivel', () => {
  const sano = { parserHealthy: true };
  assert.equal(earnTrust('review', 'strict', { reviewed: 5, confirmed: 5, serious: 0, ...sano }).trust, 'review');
  assert.equal(earnTrust('review', 'strict', { reviewed: 25, confirmed: 25, serious: 0, ...sano }).trust, 'strict');
  assert.equal(earnTrust('review', 'strict', { reviewed: 200, confirmed: 200, serious: 0, ...sano }).trust, 'strict', 'el techo B no deja pasar a automático');
  assert.equal(earnTrust('strict', 'strict', { reviewed: 25, confirmed: 17, serious: 8, ...sano }).trust, 'review');
  // Histéresis: un error no tumba a una fuente estricta con buen historial.
  assert.equal(earnTrust('strict', 'strict', { reviewed: 60, confirmed: 59, serious: 1, ...sano }).trust, 'strict');
  assert.equal(earnTrust('auto', 'auto', { reviewed: 50, confirmed: 50, serious: 0, parserHealthy: false }).trust, 'review');
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
