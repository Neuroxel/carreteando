import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { filterEvents } from '../lib/events';
import { fechaAUrl, leerRango, parseFilters } from '../lib/filters';
import { fechaDeLaNoche } from '../lib/event-extraction';
import { etiquetaRango, semanasDesde } from '../lib/rango-noches';
import type { Evento } from '../lib/types';

const ev = (id: string, fecha: string, extra: Partial<Evento> = {}): Evento =>
  ({ id, nombre: id, fecha, hora: '22:00', activo: true, ciudad: 'Valparaíso', tipo: 'concierto', categoria: 'rock', ...extra }) as Evento;
const HOY = '2026-10-24'; // sábado
const eventos = [
  ev('vie-pasado', '2026-10-23'),
  ev('sab', '2026-10-24'),
  ev('dom', '2026-10-25'),
  ev('nov7', '2026-11-07'),
  ev('nov8-vina', '2026-11-08', { ciudad: 'Viña del Mar' }),
  ev('nov9-club', '2026-11-09', { tipo: 'club', categoria: 'electronica' }),
  ev('nov10', '2026-11-10'),
];
const ids = (r: Evento[]) => r.map((e) => e.id);

test('rango: muestra directo el intervalo, inclusivo, sin recorrer meses', () => {
  assert.deepEqual(ids(filterEvents(eventos, { fecha: 'futuro', desde: '2026-11-07', hasta: '2026-11-09' }, HOY)), ['nov7', 'nov8-vina', 'nov9-club']);
});
test('rango: un solo día = Desde igual a Hasta', () => {
  assert.deepEqual(ids(filterEvents(eventos, { desde: '2026-11-08', hasta: '2026-11-08' }, HOY)), ['nov8-vina']);
});
test('rango: se combina con comuna y escena (En vivo)', () => {
  const r = filterEvents(eventos, { desde: '2026-11-07', hasta: '2026-11-10', ciudad: 'Valparaíso', escena: 'en-vivo' }, HOY);
  assert.deepEqual(ids(r), ['nov7', 'nov10']);
});
test('rango: lo vencido sigue oculto aunque el rango lo incluya', () => {
  assert.deepEqual(ids(filterEvents(eventos, { desde: '2026-10-20', hasta: '2026-10-24' }, HOY)), ['sab']);
});
test('rango manda sobre la pestaña de fecha', () => {
  assert.deepEqual(ids(filterEvents(eventos, { fecha: 'hoy', desde: '2026-10-25', hasta: '2026-10-25' }, HOY)), ['dom']);
});
test('noche: un show del sábado a la 01:00 es de la noche del viernes', () => {
  // 01:00 del sábado 7-nov en Chile (UTC-3) = 04:00Z
  const fecha = fechaDeLaNoche(new Date('2026-11-07T04:00:00Z'));
  assert.equal(fecha, '2026-11-06');
  const show = ev('madrugada', fecha, { hora: '01:00' });
  assert.deepEqual(ids(filterEvents([show], { desde: '2026-11-06', hasta: '2026-11-06' }, HOY)), ['madrugada']);
  assert.deepEqual(ids(filterEvents([show], { desde: '2026-11-07', hasta: '2026-11-08' }, HOY)), []);
});
test('URL: rango invertido se da vuelta; una fecha sola es día único; basura se ignora', () => {
  assert.deepEqual(leerRango('2026-11-09', '2026-11-07'), { desde: '2026-11-07', hasta: '2026-11-09' });
  assert.deepEqual(leerRango('2026-11-08', null), { desde: '2026-11-08', hasta: '2026-11-08' });
  assert.deepEqual(leerRango(null, '2026-11-08'), { desde: '2026-11-08', hasta: '2026-11-08' });
  assert.deepEqual(leerRango('2026-02-31', 'mañana'), { desde: null, hasta: null });
});
test('URL: ida y vuelta conserva rango, comuna y escena (atrás/adelante y enlaces compartidos)', () => {
  const f = parseFilters(new URLSearchParams('desde=2026-11-07&hasta=2026-11-09&ciudad=valparaiso&escena=en-vivo&fecha=hoy'), 'hoy');
  assert.equal(f.desde, '2026-11-07');
  assert.equal(f.hasta, '2026-11-09');
  assert.equal(f.ciudad, 'Valparaíso');
  assert.equal(f.escena, 'en-vivo');
  assert.equal(f.fecha, 'futuro', 'con rango, ninguna pestaña queda marcada como Hoy');
  const p = new URLSearchParams();
  fechaAUrl(p, f, 'hoy');
  assert.equal(p.toString(), 'desde=2026-11-07&hasta=2026-11-09');
  const unico = new URLSearchParams();
  fechaAUrl(unico, { desde: '2026-11-08', hasta: '2026-11-08' }, 'hoy');
  assert.equal(unico.toString(), 'desde=2026-11-08');
  const sinRango = new URLSearchParams();
  fechaAUrl(sinRango, { fecha: 'finde' }, 'hoy');
  assert.equal(sinRango.toString(), 'fecha=finde');
});
test('calendario: semanas de lunes a domingo desde la semana de hoy; etiqueta de noches', () => {
  const s = semanasDesde(HOY, 2);
  assert.equal(s[0][0], '2026-10-19');
  assert.equal(s[0][5], HOY);
  assert.equal(s[1][6], '2026-11-01');
  assert.match(etiquetaRango('2026-11-07', '2026-11-09'), /7.*→.*9/);
});
test('calendario: solo botones, nunca un input que abra el teclado', () => {
  const src = readFileSync(new URL('../components/CalendarioNoches.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /<input|<select|<textarea|contentEditable/);
});
test('Explorar: elegir fechas no pide nada al servidor (filtra el snapshot local)', () => {
  const src = readFileSync(new URL('../components/CalendarioNoches.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /fetch\(/);
  const ex = readFileSync(new URL('../components/ExploreClient.tsx', import.meta.url), 'utf8');
  // Los únicos fetch siguen siendo el ETag del snapshot y las geometrías del mapa.
  assert.equal((ex.match(/fetch\(/g) || []).length, 2);
});
