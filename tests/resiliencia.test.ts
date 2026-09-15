import assert from 'node:assert/strict';
import test from 'node:test';
import { filterEvents, getChileTodayStr } from '../lib/events';
import { dueSources, runSource } from '../lib/sources/dispatcher';
import { SOURCES } from '../lib/sources/registry';
import type { Evento } from '../lib/types';
import type { Fetcher } from '../lib/sources/types';
const HOY = '2026-09-18';
const evento = (fecha: string, id: string): Evento =>
  ({
    id,
    nombre: `Noche ${id}`,
    fecha,
    ciudad: 'Valparaíso',
    precio: 0,
    categoria: 'otro',
    fuente: 'editorial',
    verificado: false,
    activo: true,
    tipo: 'main',
  }) as Evento;
const filtros = { fecha: 'futuro', ciudad: 'todos', categoria: 'todos', precio: 'todos', busqueda: '', tipo: 'todos' };

test('si el cron no corre en días, lo viejo igual desaparece', () => {
  // La caducidad se resuelve al leer, no al ingerir: no depende del cron.
  const cartelera = [evento('2026-09-15', 'a'), evento('2026-09-17', 'b'), evento(HOY, 'c'), evento('2026-09-20', 'd')];
  const visibles = filterEvents(cartelera, filtros as never, HOY).map((e) => e.id);
  assert.deepEqual(visibles, ['c', 'd'], 'un evento pasado siguió visible');
  // Tres días después, sin ninguna ingesta nueva, sigue sin resucitar nada.
  const tresDiasDespues = filterEvents(cartelera, filtros as never, '2026-09-21').map((e) => e.id);
  assert.deepEqual(tresDiasDespues, [], 'la cartelera vieja sobrevivió al paso de los días');
  assert.match(getChileTodayStr(), /^\d{4}-\d{2}-\d{2}$/);
});

test('una fuente caída se reporta, no tumba la pasada', async () => {
  const caida: Fetcher = async () => {
    throw new Error('sin red');
  };
  const db = { from: () => ({ select: () => ({ eq: () => ({ limit: async () => ({ data: [] }) }) }) }) };
  const reporte = await runSource(SOURCES[0], db as never, caida, HOY);
  assert.equal(reporte.ok, false);
  assert.equal(reporte.newEvents, 0);
  assert.ok(reporte.error, 'la fuente falló sin dejar motivo');
});

test('una fuente que devuelve basura cuenta fallos de lectura, no inventa eventos', async () => {
  const basura: Fetcher = async () => ({ status: 200, body: '[{"slug":"x"},{"slug":"y"}]' });
  const db = { from: () => ({ select: () => ({ eq: () => ({ limit: async () => ({ data: [] }) }) }) }) };
  const reporte = await runSource(SOURCES[0], db as never, basura, HOY);
  assert.equal(reporte.ok, true, 'una respuesta bien formada pero vacía de datos no es una caída');
  assert.equal(reporte.newEvents, 0);
  assert.equal(reporte.candidates, 0);
  assert.equal(reporte.parseFailures, 2, 'las filas ilegibles deben quedar contadas');
});

test('una fuente atrasada varios días entra en la siguiente pasada', () => {
  const atrasadas = SOURCES.map((s) => ({ id: s.id, active: true, next_check_at: '2026-09-15T00:00:00.000Z' }));
  const despachadas = dueSources(atrasadas, new Date('2026-09-18T12:00:00Z'), 6);
  assert.equal(despachadas.length, 6, 'el atraso no se recupera solo');
});
