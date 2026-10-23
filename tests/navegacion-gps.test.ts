import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { filterEvents, sugerenciasPara } from '../lib/events';
import { parseFilters } from '../lib/filters';
import { ubicarEnDosFases, PRECISION_UTIL_M, VENTANA_PRECISA_MS, type EstadoGps } from '../lib/radar';
import type { Evento } from '../lib/types';

const ev = (id: string, ciudad: string, fecha = '2026-10-23') =>
  ({ id, nombre: 'Tributo a Soda Stereo', fecha, hora: '22:00', activo: true, ciudad, categoria: 'musica', tipo: 'bar', lugar: `Bar ${id}` }) as unknown as Evento;
const comunas = ['Valparaíso', 'Viña del Mar', 'Quilpué', 'Villa Alemana'];
const lista = comunas.flatMap((c, i) => [ev(`${i}a`, c), ev(`${i}b`, c, '2026-10-24')]);

test('comuna elegida: la lista nunca trae otra comuna, con nombres iguales y en cualquier fecha', () => {
  for (const ciudad of comunas)
    for (const fecha of ['hoy', 'manana', 'finde', 'futuro', 'todos'] as const) {
      const r = filterEvents(lista, { ciudad, fecha }, '2026-10-23');
      assert.ok(r.every((e) => e.ciudad === ciudad), `${ciudad} ${fecha}`);
    }
  // Enlace compartido con la forma corta de la URL.
  assert.equal(parseFilters(new URLSearchParams('ciudad=quilpue')).ciudad, 'Quilpué');
  assert.equal(parseFilters(new URLSearchParams('ciudad=Quilpu%C3%A9')).ciudad, 'Quilpué');
});

test('"Quilpué mañana" vacío: las sugerencias son de Quilpué, nunca de Valparaíso', () => {
  const soloHoy = [ev('valpo', 'Valparaíso'), ev('villa', 'Villa Alemana'), ev('quil', 'Quilpué'), ev('quil2', 'Quilpué', '2026-10-30')];
  const filtros = { ciudad: 'Quilpué', fecha: 'manana' as const };
  assert.equal(filterEvents(soloHoy, filtros, '2026-10-23').length, 0);
  const sug = sugerenciasPara(soloHoy, filtros, '2026-10-23');
  assert.deepEqual(sug.map((e) => e.ciudad), ['Quilpué', 'Quilpué']);
  // Sin comuna elegida, la región entera.
  assert.equal(sugerenciasPara(soloHoy, { ciudad: 'todos' }, '2026-10-23').length, 3);
});

// Geolocalización falsa controlada por la prueba.
function geoFalsa() {
  const s = { rapido: null as null | { ok: PositionCallback; err?: PositionErrorCallback | null }, watch: null as null | { ok: PositionCallback; err?: PositionErrorCallback | null }, cleared: [] as number[] };
  return {
    s,
    geo: {
      getCurrentPosition: (ok: PositionCallback, err?: PositionErrorCallback | null) => void (s.rapido = { ok, err }),
      watchPosition: (ok: PositionCallback, err?: PositionErrorCallback | null) => ((s.watch = { ok, err }), 7),
      clearWatch: (id: number) => void s.cleared.push(id),
    },
  };
}
const pos = (lat: number, accuracy: number) => ({ coords: { latitude: lat, longitude: -71.44, accuracy }, timestamp: 1 }) as GeolocationPosition;
const err = (code: number) => ({ code }) as GeolocationPositionError;
function relojFalso() {
  let fn: (() => void) | null = null;
  return { disparar: () => fn?.(), reloj: { setTimeout: ((f: () => void) => ((fn = f), 1)) as unknown as typeof setTimeout, clearTimeout: (() => (fn = null)) as unknown as typeof clearTimeout } };
}

test('GPS: fix inicial impreciso → preciso; mejora y apaga el seguimiento', () => {
  const { s, geo } = geoFalsa();
  const { reloj } = relojFalso();
  const estados: [EstadoGps, number | null][] = [];
  ubicarEnDosFases(geo, (e, f) => estados.push([e, f?.accuracy ?? null]), reloj);
  s.rapido!.ok(pos(-33.047, 2030));
  s.watch!.ok(pos(-33.047, 2500)); // peor: se ignora
  s.watch!.ok(pos(-33.047, 250));
  s.watch!.ok(pos(-33.047, PRECISION_UTIL_M - 20));
  s.watch!.ok(pos(-33.047, 10)); // ya terminó: se ignora
  assert.deepEqual(estados, [['buscando', null], ['muy_aproximada', 2030], ['aproximada', 250], ['precisa', 80]]);
  assert.deepEqual(s.cleared, [7], 'no queda siguiendo');
});

test('GPS: al vencer la ventana se queda con lo mejor; sin nada es timeout', () => {
  const a = geoFalsa();
  const r1 = relojFalso();
  const e1: EstadoGps[] = [];
  ubicarEnDosFases(a.geo, (e) => e1.push(e), r1.reloj);
  a.s.rapido!.ok(pos(-33.04, 600));
  r1.disparar(); // 18 s con ±600 m y en Radar: una prórroga
  assert.deepEqual(a.s.cleared, [], 'sigue buscando mejora');
  r1.disparar(); // ~30 s: se corta igual
  assert.deepEqual(e1, ['buscando', 'muy_aproximada', 'muy_aproximada']);
  assert.deepEqual(a.s.cleared, [7]);
  const b = geoFalsa();
  const r2 = relojFalso();
  const e2: EstadoGps[] = [];
  ubicarEnDosFases(b.geo, (e) => e2.push(e), r2.reloj);
  r2.disparar();
  assert.deepEqual(e2, ['buscando', 'timeout']);
  assert.ok(VENTANA_PRECISA_MS <= 20_000);
});

test('GPS: permiso denegado y posición no disponible', () => {
  const a = geoFalsa();
  const e1: EstadoGps[] = [];
  ubicarEnDosFases(a.geo, (e) => e1.push(e), relojFalso().reloj);
  a.s.rapido!.err!(err(1));
  assert.deepEqual(e1, ['buscando', 'negado']);
  assert.deepEqual(a.s.cleared, [7]);
  const b = geoFalsa();
  const e2: EstadoGps[] = [];
  ubicarEnDosFases(b.geo, (e) => e2.push(e), relojFalso().reloj);
  b.s.watch!.err!(err(2));
  assert.deepEqual(e2, ['buscando', 'no_disponible']);
});

test('/radar abre el mapa y pide la ubicación (no /confianza)', () => {
  const src = readFileSync(new URL('../app/radar/page.tsx', import.meta.url), 'utf8');
  assert.match(src, /permanentRedirect\('\/\?vista=mapa&ubicar=1'\)/);
  assert.doesNotMatch(src, /confianza/);
});
