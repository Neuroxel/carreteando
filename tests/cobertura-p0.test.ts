import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { portaldiscRegion } from '../lib/sources/adapters/portaldisc';
import { leerVesti } from '../lib/sources/adapters/vesti';
import { sourceById, SOURCES } from '../lib/sources/registry';
import { cadenciaHoras, conCadencia, dueSources, FUENTES_FRECUENTES } from '../lib/sources/dispatcher';
import { indiceDeLugares } from '../lib/venue-match';
import { saludCobertura, type FilaFuente } from '../lib/salud-cobertura';
import { editorialesDePassline, passlineDelDia, PASSLINE_COLA, type FilaPassline } from '../lib/passline';
import { editorialRows } from '../lib/editorial-feed';
import { RUTAS_LOCALES, validarRutas } from '../lib/venue-routes';
import { EVENTLY_HOSTS } from '../lib/sources/hosts';
import type { Lugar } from '../lib/venues';

const fx = (n: string) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');
const chile = (s: string) => new Date(`${s}-03:00`);

test('PortalTickets 23-oct: los 6 eventos del viernes salen con fecha, hora, lugar y confianza alta', async (t) => {
  // Reloj fijo: el adaptador descarta lo pasado y el fixture es del 23-oct.
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-23T15:00:00Z') });
  const html = fx('portaldisc-region-R05-2026-10-23.html');
  const r = await portaldiscRegion.run(sourceById('portaldisc-region')!, async (u) => (u.includes('/tickets/') ? { status: 200, body: html } : { status: 404, body: '' }), {});
  const esperados: [RegExp, string, string][] = [
    [/^KAZUAKI/, '17:00', 'Panic House'],
    [/^EMILY WITTBRODT/, '18:30', 'Balmaceda Arte Joven - Valparaíso'],
    [/^JULIO PIÑA/, '19:00', 'Café Teatro VP - Valparaíso Profundo'],
    [/^LUCAS ESPINOZA/, '20:00', 'Barbones Curauma'],
    [/^FULL Y LA MÚSICA DE FULANO/, '20:00', 'Teatro Mauri SCD'],
    [/^DE ROMPER SUS PÉTALOS/, '21:00', 'Club Segundo Piso'],
  ];
  for (const [titulo, hora, lugar] of esperados) {
    const c = r.candidates.find((x) => titulo.test(x.title));
    assert.ok(c, String(titulo));
    assert.deepEqual([c!.date, c!.time, c!.venue, c!.city, c!.confidence], ['2026-10-23', hora, lugar, 'Valparaíso', 'high'], String(titulo));
  }
  assert.equal(r.parseFailures, 0);
  // Lugar reconocido (como en la base, con su nombre largo): el motor puede publicar por regla 2.
  const venues = [
    ['panic-house', 'Panic House'],
    ['balmaceda-arte-joven-valparaiso-valparaiso', 'Balmaceda Arte Joven - Valparaíso'],
    ['cafe-teatro-vp-valparaiso-profundo-valparaiso', 'Café Teatro VP - Valparaíso Profundo'],
    ['barbones-curauma', 'Barbones Curauma'],
    ['teatro-mauri-scd', 'Teatro Mauri SCD'],
    ['club-segundo-piso', 'Club Segundo Piso'],
  ].map(([slug, nombre]) => ({ slug, nombre, ciudad: 'Valparaíso', alias: [] }) as unknown as Lugar);
  const lugarDe = indiceDeLugares(venues);
  for (const [, , lugar] of esperados) assert.ok(lugarDe(lugar, 'Valparaíso'), lugar);
});

test('Vesti: "VIERNES 23" vendido como 24-oct 01:00 UTC es la noche del viernes 23 a las 22:00', () => {
  const r = leerVesti(fx('vesti-studio-valparaiso-2026-10-23.html'), { id: 'x', commune: 'Valparaíso', venueName: 'Studio Valparaíso' }, '2026-10-23');
  const viernes = r.candidates.find((c) => /VIERNES 23 OCTUBRE/i.test(c.title))!;
  assert.deepEqual([viernes.date, viernes.time], ['2026-10-23', '22:00']);
});

test('frecuencia: ticketeras regionales y rutas por local cada 6 h jue–sáb y 12 h el resto; las demás igual', () => {
  const pt = sourceById('portaldisc-region')!;
  assert.equal(cadenciaHoras(pt, chile('2026-10-23T15:00:00')), 6, 'viernes');
  assert.equal(cadenciaHoras(pt, chile('2026-10-25T02:00:00')), 6, 'domingo 02:00 sigue siendo la noche del sábado');
  assert.equal(cadenciaHoras(pt, chile('2026-10-27T15:00:00')), 12, 'martes');
  const otra = SOURCES.find((s) => !FUENTES_FRECUENTES(s) && s.accessMode !== 'blocked')!;
  assert.equal(cadenciaHoras(otra, chile('2026-10-23T15:00:00')), otra.refreshHours);
  assert.ok(!FUENTES_FRECUENTES({ id: 'passline-region', accessMode: 'blocked' }), 'bloqueada nunca');
});

test('viernes sin eventos conocidos: PortalTickets vence a las 6 h aunque su turno fuera a las 24 h', () => {
  const ahora = chile('2026-10-23T15:00:00');
  const filas = [
    { id: 'portaldisc-region', active: true, next_check_at: '2026-10-24T09:00:00.000Z', last_checked_at: new Date(ahora.getTime() - 7 * 3600_000).toISOString() },
    { id: 'pcdv-agenda', active: true, next_check_at: '2026-10-24T09:00:00.000Z', last_checked_at: new Date(ahora.getTime() - 7 * 3600_000).toISOString() },
  ];
  const ids = dueSources(filas, ahora, 8, conCadencia(new Map(), ahora)).map((s) => s.id);
  assert.deepEqual(ids, ['portaldisc-region']);
  // Leída hace 2 h: todavía no.
  const recien = [{ ...filas[0], last_checked_at: new Date(ahora.getTime() - 2 * 3600_000).toISOString() }];
  assert.deepEqual(dueSources(recien, ahora, 8, conCadencia(new Map(), ahora)).map((s) => s.id), []);
});

test('anti-inanición: aunque las frecuentes vençan todas, la reserva sigue leyendo las atrasadas normales', () => {
  const ahora = chile('2026-10-23T15:00:00');
  const viejo = new Date(ahora.getTime() - 30 * 3600_000).toISOString();
  const frecuentes = SOURCES.filter(FUENTES_FRECUENTES).map((s) => ({ id: s.id, active: true, next_check_at: viejo, last_checked_at: viejo }));
  const normal = { id: 'pcdv-agenda', active: true, next_check_at: '2026-10-01T00:00:00.000Z', last_checked_at: viejo };
  const ids = dueSources([...frecuentes, normal], ahora, 4, conCadencia(new Map(), ahora)).map((s) => s.id);
  assert.ok(ids.includes('pcdv-agenda'), 'la más atrasada por turno entra por la reserva');
});

const fuente = (id: string, horas: number | null, ancla = '2026-10-23T18:00:00Z', extra: Partial<FilaFuente> = {}): FilaFuente => ({
  id,
  active: true,
  last_checked_at: horas === null ? null : new Date(Date.parse(ancla) - horas * 3600_000).toISOString(),
  last_success_at: horas === null ? null : new Date(Date.parse(ancla) - horas * 3600_000).toISOString(),
  last_error: null,
  consecutive_failures: 0,
  candidate_count: 3,
  parse_failure_count: 0,
  next_check_at: null,
  ...extra,
});
const base = {
  ahora: new Date('2026-10-23T18:00:00Z'),
  fecha: '2026-10-23',
  snapshotGeneradoEn: '2026-10-23T17:00:00Z',
  registro: SOURCES,
  fuentes: SOURCES.filter(FUENTES_FRECUENTES).map((s) => fuente(s.id, 2)),
  eventos: [
    { city: 'Valparaíso', date_text: '2026-10-23', disposition: 'public', source_id: 'portaldisc-region' },
    { city: 'Valparaíso', date_text: '2026-10-23', disposition: 'public', source_id: 'portaldisc-region' },
    { city: 'Viña del Mar', date_text: '2026-10-23', disposition: 'review', source_id: 'ticketplus-region' },
  ],
};

test('salud: HEALTHY, STALE, DEGRADED y REVIEW_BACKLOG', () => {
  const ok = saludCobertura(base);
  assert.equal(ok.estado, 'HEALTHY');
  assert.deepEqual(ok.hoy, { publicos: 2, revision: 1 });
  assert.equal(ok.por_comuna[0].comuna, 'Valparaíso');
  assert.equal(saludCobertura({ ...base, snapshotGeneradoEn: '2026-10-23T09:00:00Z' }).estado, 'STALE');
  const sinPt = saludCobertura({ ...base, fuentes: base.fuentes.map((f) => (f.id === 'portaldisc-region' ? fuente(f.id, 13) : f)) });
  assert.equal(sinPt.estado, 'DEGRADED', 'PortalTickets >12 h un viernes');
  const martes = saludCobertura({ ...base, fecha: '2026-10-27', ahora: new Date('2026-10-27T18:00:00Z'), snapshotGeneradoEn: '2026-10-27T17:00:00Z', fuentes: base.fuentes.map((f) => fuente(f.id, f.id === 'portaldisc-region' ? 13 : 2, '2026-10-27T18:00:00Z')) });
  assert.notEqual(martes.estado, 'DEGRADED', 'un martes el margen es 24 h');
  const cola = saludCobertura({ ...base, eventos: [...base.eventos, ...[1, 2].map(() => ({ city: 'Valparaíso', date_text: '2026-10-23', disposition: 'review', source_id: 'x' }))] });
  assert.equal(cola.estado, 'REVIEW_BACKLOG');
  assert.ok(!JSON.stringify(ok).match(/secret|token|key/i), 'sin secretos');
});

test('Passline hoy: cola de revisión; solo lo verificado por una persona llega al feed editorial', () => {
  const hoy = passlineDelDia(PASSLINE_COLA, '2026-10-23');
  assert.ok(hoy.length >= 4 && hoy.every((f) => f.estado === 'por_revisar'));
  assert.ok(hoy.some((f) => /Camionero/.test(f.evento) && f.hora === '22:00'));
  assert.equal(editorialesDePassline().length, 0, 'por revisar no publica');
  const verificada: FilaPassline = { ...PASSLINE_COLA[1], estado: 'verificado', verificado_por: 'work', verificado_en: '2026-10-23T16:00:00Z' };
  const filas = editorialesDePassline([verificada]);
  assert.equal(filas.length, 1);
  assert.match(filas[0].review_basis, /verificado a mano por work/);
  assert.equal(filas[0].source_url, 'https://www.passline.com/venue/trotamundos-valparaiso');
  const otroHost: FilaPassline = { ...verificada, url: 'https://agregador.cl/evento' };
  assert.equal(editorialesDePassline([otroHost]).length, 0, 'solo URL primaria de Passline');
  assert.ok(Array.isArray(editorialRows(new Date('2026-10-23T18:00:00Z'))));
});

test('rutas por local: todas válidas, hosts Evently exactos, sin comodín', () => {
  assert.deepEqual(validarRutas(RUTAS_LOCALES), []);
  assert.ok(RUTAS_LOCALES.length >= 15);
  assert.ok(EVENTLY_HOSTS.every((h) => /^[a-z0-9-]+\.evently\.cl$/.test(h) && !h.includes('*')));
  const vesti = RUTAS_LOCALES.flatMap((l) => l.rutas).filter((r) => r.tipo === 'vesti_company' && r.acceso === 'auto');
  assert.ok(vesti.length >= 12, `${vesti.length} rutas Vesti`);
  assert.ok(vesti.some((r) => r.url === 'https://vesti.cl/company/terraza-bellavista'));
});

test('ingesta: si vencer eventos falla, la corrida sigue y deja el error de Postgres para diagnóstico', () => {
  const src = readFileSync(new URL('../app/api/cron/scrape/route.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /throw new IngestionError\('DB_EXPIRE'\)/);
  assert.match(src, /metrics\.expire_error = \{/);
});

test('passline_hoy reconcilia con la DB: lo ya público no queda por revisar', async () => {
  const { reconciliarPassline, passlineDelDia, PASSLINE_COLA } = await import('../lib/passline');
  const cola = passlineDelDia(PASSLINE_COLA, '2026-10-23');
  const r = reconciliarPassline(cola, [
    { title: 'Las Vidas de Charly en Trotamundos', date_text: '2026-10-23', disposition: 'public' },
    { title: 'Camionero', date_text: '2026-10-23', disposition: 'review' },
    { title: 'Camionero', date_text: '2026-10-30', disposition: 'public' },
  ]);
  const por = (t: string) => r.find((f) => f.evento === t)!;
  assert.equal(por('Las Vidas de Charly').estado, 'publicado');
  assert.equal(por('Camionero').estado, 'por_revisar');
  assert.equal(por('Camionero').estado_db, 'review');
  assert.equal(por('Fiesta de Halloween - Averno').estado_db, null);
});
