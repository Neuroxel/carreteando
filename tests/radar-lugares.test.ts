import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { isValidElement, type ReactElement, type ReactNode } from 'react';
import { indiceDeLugares } from '../lib/venue-match';
import { debeCentrar } from '../lib/radar';
import { puntosDeMapa } from '../lib/map';
import { DESTINOS } from '../lib/destinos';
import type { Lugar } from '../lib/venues';
import type { Evento } from '../lib/types';

const lugar = (slug: string, nombre: string, ciudad: string, alias: string[] = [], lat: number | null = -33.04) =>
  ({ slug, nombre, ciudad, alias, lat, lng: lat === null ? null : -71.6, precision_mapa: lat === null ? null : 'exacta', zona: null, direccion: null, tipo: 'bar', tipo_label: 'Bar', tags: [], instagram_url: null }) as unknown as Lugar;
const catalogo = [
  lugar('liberty', 'Liberty', 'Valparaíso'),
  lugar('cafe-rock-villa-alemana', 'Café Rock', 'Villa Alemana', ['Café Rock Multiespacio']),
  lugar('manda-renaca', 'Manda', 'Reñaca'),
  lugar('manda-vina', 'Manda', 'Viña del Mar', ['Manda Viña del Mar']),
];

test('alias de lugar: explícitos y de la base, con misma ciudad; nunca parecidos', () => {
  const lugarDe = indiceDeLugares(catalogo);
  assert.equal(lugarDe('Bar Liberty', 'Valparaíso'), 'liberty', 'alias explícito revisado');
  assert.equal(lugarDe('Café Rock Multiespacio', 'Villa Alemana'), 'cafe-rock-villa-alemana', 'alias de la base');
  assert.equal(lugarDe('Manda', 'Viña del Mar'), 'manda-vina');
  assert.equal(lugarDe('Manda', 'Reñaca'), 'manda-renaca');
  assert.equal(lugarDe('Manda', 'Concón'), null, 'dos "Manda": sin ciudad que calce no se adivina');
  assert.equal(lugarDe('Liberty', 'Quilpué'), null, 'otra comuna no es el mismo local');
  assert.equal(lugarDe('Liberty', null), 'liberty', 'sin ciudad, solo un nombre único');
  assert.equal(lugarDe('Liberty Club', 'Valparaíso'), null, 'parecido no es igual');
  assert.equal(lugarDe('Bar Liberty', 'Viña del Mar'), null, 'un alias exige la misma ciudad');
});

test('Radar: el evento de "Bar Liberty" aparece en el pin de Liberty', () => {
  const lugarDe = indiceDeLugares(catalogo);
  const ev = { id: '1', nombre: 'Tributo', fecha: '2026-10-17', hora: '20:00', lugar: 'Bar Liberty', ciudad: 'Valparaíso' } as Evento;
  const antes = puntosDeMapa(catalogo, [ev], '2026-10-17').find((p) => p.slug === 'liberty');
  const ahora = puntosDeMapa(catalogo, [ev], '2026-10-17', {}, (e) => lugarDe(e.lugar, e.ciudad)).find((p) => p.slug === 'liberty');
  assert.equal(antes?.estado, 'lugar');
  assert.equal(ahora?.estado, 'evento');
});

test('Radar: centrar en la persona salvo que ya haya movido el mapa', () => {
  const yo = { lat: -33.0389, lng: -71.6283 };
  const cerca = [{ lat: -33.04, lng: -71.63 }];
  assert.equal(debeCentrar(yo, cerca, false), true);
  assert.equal(debeCentrar(yo, cerca, true), false, 'no se le quita el mapa de las manos');
  assert.equal(debeCentrar(null, cerca, false), false);
  assert.equal(debeCentrar({ lat: -36.8, lng: -73.05 }, cerca, false), false, 'fuera de la región no se centra');
});

test('navegación: Carretes · Lugares · Radar · Aportar; "Boliches" ya no es una etiqueta', () => {
  assert.deepEqual(DESTINOS.map((d) => d.label), ['Carretes', 'Lugares', 'Radar', 'Aportar']);
  assert.ok(!DESTINOS.some((d) => /boliche/i.test(d.label)));
});

/** Texto visible para lectores de pantalla en un árbol de elementos (sin renderizar). */
function texto(n: ReactNode): string {
  if (n === null || n === undefined || typeof n === 'boolean') return '';
  if (typeof n === 'string' || typeof n === 'number') return String(n);
  if (Array.isArray(n)) return n.map(texto).join('');
  if (isValidElement(n)) {
    const el = n as ReactElement<{ children?: ReactNode; 'aria-hidden'?: boolean; decorativo?: boolean }>;
    if (el.props['aria-hidden'] || el.props.decorativo) return '';
    return texto(el.props.children);
  }
  return '';
}

test('portada: el H1 tiene nombre accesible y el logo es decorativo ahí', async () => {
  // Los componentes se compilan con el JSX clásico en las pruebas.
  (globalThis as { React?: typeof React }).React = React;
  const { default: TituloSeccion } = await import('../components/TituloSeccion');
  const h1 = TituloSeccion({ home: true, vista: 'lista', ver: 'todo' }) as ReactElement<{ children: ReactNode }>;
  assert.equal(h1.type, 'h1');
  assert.equal(texto(h1).trim(), 'Dónde Salgo');
  const lugares = TituloSeccion({ home: false, vista: 'lista', ver: 'lugares' }) as ReactElement;
  assert.match(texto(lugares), /^Lugares para salir\.$/);
});
