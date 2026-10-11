import assert from 'node:assert/strict';
import test from 'node:test';
import { dentroDelPresupuesto, esBarato, filterEvents, ordenarPorPrecio } from '../lib/events';
import { parseFilters } from '../lib/filters';
import type { Evento } from '../lib/types';

const ev = (id: string, precio: number, conocido: boolean): Evento =>
  ({ id, nombre: id, fecha: '2026-10-10', hora: '21:00', ciudad: 'Valparaíso', lugar: id, activo: true, precio, precio_conocido: conocido, categoria: 'fiesta', tipo: 'fiesta' }) as unknown as Evento;
const gratis = ev('gratis', 0, true);
const cinco = ev('cinco', 5000, true);
const diez = ev('diez', 10000, true);
const quince = ev('quince', 15000, true);
const cara = ev('cara', 45000, true);
const desconocido = ev('desconocido', 0, false);

test('un precio desconocido nunca es gratis ni barato', () => {
  assert.equal(dentroDelPresupuesto(desconocido, 'gratis'), false);
  assert.equal(dentroDelPresupuesto(desconocido, '5000'), false);
  assert.equal(esBarato(desconocido), false);
});

test('los topes incluyen lo gratis y respetan el límite', () => {
  const todos = [gratis, cinco, diez, quince, cara, desconocido];
  const ids = (precio: string) => filterEvents(todos, { fecha: 'hoy', precio: precio as never }, '2026-10-10').map((e) => e.id).sort();
  assert.deepEqual(ids('gratis'), ['gratis']);
  assert.deepEqual(ids('5000'), ['cinco', 'gratis']);
  assert.deepEqual(ids('10000'), ['cinco', 'diez', 'gratis']);
  assert.deepEqual(ids('15000'), ['cinco', 'diez', 'gratis', 'quince']);
  assert.deepEqual(ids('pago'), ['cara', 'cinco', 'diez', 'quince']);
  assert.equal(ids('todos').length, 6);
});

test('más barato primero; lo desconocido al final, sin contar como cero', () => {
  assert.deepEqual(ordenarPorPrecio([desconocido, cara, cinco, gratis]).map((e) => e.id), ['gratis', 'cinco', 'cara', 'desconocido']);
});

test('la URL acepta los topes nuevos y no rompe los enlaces viejos', () => {
  for (const v of ['gratis', '5000', '10000', '15000', 'pago', 'todos'])
    assert.equal(parseFilters(new URLSearchParams(`precio=${v}`)).precio, v);
  assert.equal(parseFilters(new URLSearchParams('precio=999')).precio, 'todos');
});
