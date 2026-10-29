import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sigueTrasCorte, visibleEnCartelera } from '../lib/temporal';
import { cuantos, eventosLista, eventosRadar, lugaresLista, lugaresRadar, type Contexto } from '../lib/resultados';
import type { Evento } from '../lib/types';
import type { Lugar } from '../lib/venues';

test('fin confirmado y límite provisional para eventos sin fin', () => {
  const fecha = '2026-10-25';
  const a = (minutos: number) => ({ fecha, minutos });
  assert.equal(visibleEnCartelera({ fecha, hora: '11:00' }, a(23 * 60 + 52)), false);
  assert.equal(visibleEnCartelera({ fecha, hora: '11:00' }, a(18 * 60 + 59)), true);
  assert.equal(visibleEnCartelera({ fecha, hora: '11:00' }, a(19 * 60)), false);
  assert.equal(visibleEnCartelera({ fecha, hora: '11:00', fin: '23:59' }, a(23 * 60 + 52)), true);
  assert.equal(visibleEnCartelera({ fecha, hora: '11:00', fin: '12:00' }, a(12 * 60)), false);
  assert.equal(visibleEnCartelera({ fecha, hora: null }, a(23 * 60)), true);
});

test('noche cruza la medianoche y respeta el fin real', () => {
  const e = { fecha: '2026-10-24', hora: '23:00' };
  const a = (minutos: number) => ({ fecha: '2026-10-25', minutos });
  assert.equal(visibleEnCartelera(e, a(2 * 60)), true);
  assert.equal(visibleEnCartelera({ ...e, fin: '03:00' }, a(3 * 60)), false);
  assert.equal(visibleEnCartelera(e, a(7 * 60)), false);
});

test('lista, radar y conteos concuerdan para eventos que dejaron de mostrarse', () => {
  const evento = (id: string, hora: string) => ({ id, nombre: id, fecha: '2026-10-25', hora, activo: true, ciudad: 'Valparaíso', lugar: id, categoria: 'otro', tipo: 'bar' }) as Evento;
  const lugares = ['pasado', 'noche'].map((slug) => ({ slug, nombre: slug, ciudad: 'Valparaíso' }) as Lugar);
  const c: Contexto = { todos: [evento('pasado', '11:00'), evento('noche', '22:00')], lugares, today: '2026-10-25', ahora: { fecha: '2026-10-25', minutos: 23 * 60 + 52 }, lugarDe: (e) => e.lugar || null, sectorDe: () => null };
  const f = { fecha: 'hoy' as const, ciudad: 'Valparaíso', tipo: 'bar' as const };
  assert.deepEqual(eventosLista(c, f).map((e) => e.id), ['noche']);
  assert.deepEqual(eventosRadar(c, f).map((e) => e.id), ['noche']);
  assert.equal(cuantos(c, f, { vista: 'lista', ver: 'eventos', capa: 'hoy' }), 1);
  assert.equal(cuantos(c, f, { vista: 'mapa', ver: 'eventos', capa: 'hoy' }), 1);
  assert.deepEqual(lugaresLista(c, f).map((l) => l.slug), ['noche']);
  assert.deepEqual(lugaresRadar(c, f, 'hoy').map((l) => l.slug), ['noche']);
});


test('un cierre confirmado después de las 05 sigue en lista, mapa y conteos hasta terminar', () => {
  const mk = (id: string, fin: string | null) => ({ id, nombre: id, fecha: '2026-10-28', hora: '23:00', fin, activo: true, ciudad: 'Valparaíso', lugar: id, categoria: 'otro', tipo: 'bar' }) as Evento;
  const activos = [mk('hasta-6', '06:00'), mk('terminado', '05:15'), mk('sin-fin', null)];
  const ahora = { fecha: '2026-10-29', minutos: 5 * 60 + 30 };
  const c: Contexto = { todos: activos, lugares: [], today: '2026-10-29', ahora, lugarDe: (e) => e.lugar || null, sectorDe: () => null };
  const f = { fecha: 'hoy' as const, ciudad: 'Valparaíso' };
  assert.deepEqual(eventosLista(c, f).map((e) => e.id), ['hasta-6']);
  assert.deepEqual(eventosRadar(c, f).map((e) => e.id), ['hasta-6']);
  assert.equal(cuantos(c, f, { vista: 'lista', ver: 'eventos', capa: 'hoy' }), 1);
  assert.equal(sigueTrasCorte(activos[0], { ...ahora, minutos: 6 * 60 }), false);
  assert.equal(sigueTrasCorte({ ...activos[0], fecha: '2026-10-27' }, ahora), false);
  assert.equal(sigueTrasCorte({ ...activos[0], hora: '02:00' }, ahora), false);
});
