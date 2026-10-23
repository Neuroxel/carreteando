import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cuantos, eventosLista, lugaresLista, type Contexto, type Modo } from '../lib/resultados';
import { calidad, fixUtil, ubicarEnDosFases, type EstadoGps } from '../lib/radar';
import type { Evento } from '../lib/types';
import type { Lugar } from '../lib/venues';

const HOY = '2026-10-23';
const ev = (id: string, ciudad: string, categoria: string, fecha = HOY, nombre = 'Noche') =>
  ({ id, nombre, descripcion: '', fecha, hora: '22:00', activo: true, ciudad, categoria, tipo: 'bar', lugar: `L-${id}`, tags: [] }) as unknown as Evento;
const lugar = (slug: string, ciudad: string, tags: string[]) => ({ slug, nombre: slug, ciudad, tipo: 'bar', tags }) as unknown as Lugar;

const todos = [
  ev('r1', 'Quilpué', 'rock'),
  ev('r2', 'Quilpué', 'rock'),
  ...['v1', 'v2', 'v3', 'v4'].map((i) => ev(i, 'Valparaíso', 'rock')),
  ev('m1', 'Valparaíso', 'rock', '2026-10-24'), // mañana
  ev('q-manana', 'Valparaíso', 'fiesta', '2026-10-24', 'Fiesta drag queer'),
];
const lugares = [1, 2, 3, 4].map((i) => lugar(`queer-${i}`, 'Valparaíso', ['queer']));
const ctx: Contexto = { todos, lugares, today: HOY, ahora: { fecha: HOY, minutos: 20 * 60 }, lugarDe: () => null, sectorDe: () => null };
const carretes: Modo = { vista: 'lista', ver: 'todo', capa: 'hoy' };
const vistaLugares: Modo = { vista: 'lista', ver: 'lugares', capa: 'hoy' };

test('contador = lo que aparece al tocar: 0 eventos queer hoy + 4 lugares queer → Carretes no dice "Queer 4"', () => {
  const f = { fecha: 'hoy' as const, ciudad: 'Valparaíso', escena: 'queer' };
  assert.equal(cuantos(ctx, f, carretes), 0, 'el evento queer es mañana: no cuenta para Hoy');
  assert.equal(eventosLista(ctx, f).length, 0);
  assert.equal(cuantos(ctx, f, vistaLugares), 4, 'en Lugares sí aparecen los 4 lugares queer');
  assert.equal(lugaresLista(ctx, f).length, 4);
});

test('contador por comuna: 2 de rock en Quilpué + 4 en Valparaíso → Quilpué dice Rock 2; mañana no afecta Hoy', () => {
  assert.equal(cuantos(ctx, { fecha: 'hoy', ciudad: 'Quilpué', escena: 'rock' }, carretes), 2);
  assert.equal(cuantos(ctx, { fecha: 'hoy', ciudad: 'Valparaíso', escena: 'rock' }, carretes), 4);
  assert.equal(cuantos(ctx, { fecha: 'manana', ciudad: 'Valparaíso', escena: 'rock' }, carretes), 1);
  // La búsqueda también recorta el número.
  assert.equal(cuantos(ctx, { fecha: 'hoy', ciudad: 'Quilpué', busqueda: 'inexistente' }, carretes), 0);
});

test('GPS: niveles de precisión 20 / 80 / 250 / 600 / 2030 m', () => {
  const f = (accuracy: number) => ({ lat: -33, lng: -71.6, accuracy, timestamp: Date.now() });
  assert.deepEqual([20, 80, 250, 600, 2030].map((m) => calidad(f(m))), ['precisa', 'precisa', 'aproximada', 'muy_aproximada', 'muy_aproximada']);
  assert.equal(fixUtil(f(250)), true);
  assert.equal(fixUtil(f(2030)), false, 'muy impreciso: volver a precisar en vez de recentrar');
  assert.equal(fixUtil({ ...f(20), timestamp: Date.now() - 5 * 60_000 }), false, 'viejo: volver a precisar');
});

test('GPS: sin prórroga si la persona ya salió del Radar', () => {
  let fn: (() => void) | null = null;
  const reloj = { setTimeout: ((g: () => void) => ((fn = g), 1)) as unknown as typeof setTimeout, clearTimeout: (() => (fn = null)) as unknown as typeof clearTimeout };
  let ok: PositionCallback | null = null;
  const cleared: number[] = [];
  const geo = { getCurrentPosition: (c: PositionCallback) => void (ok = c), watchPosition: () => 9, clearWatch: (id: number) => void cleared.push(id) };
  const estados: EstadoGps[] = [];
  ubicarEnDosFases(geo, (e) => estados.push(e), reloj, () => false);
  ok!({ coords: { latitude: -33, longitude: -71.6, accuracy: 2030 }, timestamp: 1 } as GeolocationPosition);
  (fn as unknown as () => void)();
  assert.deepEqual(cleared, [9]);
  assert.equal(estados.at(-1), 'muy_aproximada');
});

test('inicio y radar: un solo camino', () => {
  const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
  const explore = src('components/ExploreClient.tsx');
  // El wordmark grande de la portada es un enlace al inicio, como el del header.
  assert.match(explore, /<BrandLink className="hero-logo-link">\s*<LogoApilado/);
  assert.match(src('components/BrandLink.tsx'), /aria-label="Ir al inicio de Dónde Salgo"/);
  assert.match(src('components/Navbar.tsx'), /<BrandLink/);
  // Mapa y "cerca de mí" usan la misma entrada que la barra (gesto → GPS).
  assert.equal((explore.match(/onClick=\{abrirRadar\}/g) || []).length, 2);
  assert.match(explore, /window\.addEventListener\('radar:abrir'/);
  // Lista/Mapa ya no viven dentro de Filtros.
  const filtros = explore.slice(explore.indexOf('const filtrosUI = ('), explore.indexOf('return (\n    <>'));
  assert.doesNotMatch(filtros, /'mapa', 'Mapa'|Usar mi ubicación/);
});
