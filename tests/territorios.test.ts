import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TERRITORIOS, enGeometria, sectorDeLugar, territorioDe, territorioPorSlug, zonaValida, type TerritorioGeo } from '../lib/territorios';
import { parseFilters } from '../lib/filters';

const geos = (JSON.parse(readFileSync(new URL('../public/territorios.geojson', import.meta.url), 'utf8')) as { features: TerritorioGeo[] }).features;
const lugares = (JSON.parse(readFileSync(new URL('../data/lugares-territorio.json', import.meta.url), 'utf8')) as {
  lugares: Record<string, { sector: string; lat: number; lng: number }>;
}).lugares;

test('territorios: índice y geometrías coinciden, con procedencia oficial y sin slugs repetidos', () => {
  const sectores = TERRITORIOS.filter((t) => t.nivel === 'sector');
  assert.equal(sectores.length, 54);
  assert.equal(new Set(TERRITORIOS.map((t) => t.slug)).size, TERRITORIOS.length);
  assert.deepEqual(geos.map((g) => g.properties.slug).sort(), sectores.map((t) => t.slug).sort());
  for (const t of sectores) {
    assert.match(t.source_url || '', /^https:\/\/services8\.arcgis\.com\/5BaAHTQ4nRVz57H5\//, t.slug);
    assert.equal(t.source_type, 'sig_municipal');
    assert.ok(t.verified_at && t.parent === 'comuna-valparaiso');
  }
  for (const n of ['Cerro Alegre', 'Cerro Concepción', 'Barrio Puerto', 'Almendral', 'Cerro Playa Ancha', 'Placilla de Peñuelas'])
    assert.ok(TERRITORIOS.some((t) => t.nombre === n), n);
});

test('cada lugar con sector cae dentro de su polígono oficial', () => {
  assert.ok(Object.keys(lugares).length >= 20);
  for (const [slug, l] of Object.entries(lugares)) {
    const g = geos.find((f) => f.properties.slug === l.sector)!;
    assert.ok(enGeometria(l, g.geometry), slug);
    assert.equal(territorioDe(l, geos)?.slug, l.sector, slug);
    assert.equal(sectorDeLugar(slug), l.sector);
  }
  assert.equal(sectorDeLugar('trotamundos-quilpue'), null, 'sin polígono verificado no se adivina');
});

test('GPS → territorio: Valparaíso por sector; fuera de lo verificado, nada inventado', () => {
  const alegre = Object.values(lugares).find((l) => l.sector === 'valparaiso-cerro-alegre')!;
  assert.equal(territorioDe(alegre, geos)?.nombre, 'Cerro Alegre');
  const puerto = Object.values(lugares).find((l) => l.sector === 'valparaiso-barrio-puerto')!;
  assert.equal(territorioDe(puerto, geos)?.nombre, 'Barrio Puerto');
  assert.equal(territorioDe({ lat: -33.0475, lng: -71.4425 }, geos), null, 'Quilpué Centro: sin capa verificada todavía');
  assert.equal(territorioDe({ lat: -33.0245, lng: -71.5518 }, geos), null, 'Viña Centro: sin capa verificada todavía');
});

test('URL ?zona=: válida solo con su comuna; compartible', () => {
  assert.equal(zonaValida('valparaiso-cerro-alegre', 'Valparaíso'), 'valparaiso-cerro-alegre');
  assert.equal(zonaValida('valparaiso-cerro-alegre', 'Quilpué'), null);
  assert.equal(zonaValida('inventada', 'Valparaíso'), null);
  assert.equal(parseFilters(new URLSearchParams('ciudad=Valparaíso&zona=valparaiso-cerro-alegre')).zona, 'valparaiso-cerro-alegre');
  assert.equal(parseFilters(new URLSearchParams('zona=valparaiso-cerro-alegre')).zona, null, 'sin comuna la zona no aplica');
  assert.equal(territorioPorSlug('valparaiso-cerro-alegre')?.comuna, 'Valparaíso');
});
