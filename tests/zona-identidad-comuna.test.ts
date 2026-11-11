import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dbRowToLugar, encontrarZona, zonaRuta, zonasDe } from '../lib/venues';

const lugar = (slug: string, ciudad: string, zona: string | null) =>
  dbRowToLugar({
    slug,
    name: slug,
    city: ciudad,
    zone: zona,
    is_active: true,
    moderation_status: 'approved',
    venue_type: 'bar',
  })!;

test('zonas: Reñaca aliases and Viña records share one administrative sector without duplicates', () => {
  const venues = [
    lugar('renaca-sector', 'Reñaca', 'Reñaca'),
    lugar('vina-renaca', 'Viña del Mar', 'Reñaca'),
    lugar('vina-centro', 'Viña del Mar', 'Viña Centro'),
    lugar('no-zone', 'Viña del Mar', null),
  ];
  const groups = zonasDe(venues);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups.find((g) => g.ciudad === 'Viña del Mar' && g.zona === 'Reñaca')?.lugares.map((l) => l.slug), ['renaca-sector', 'vina-renaca']);
  assert.equal(zonaRuta('Reñaca', 'Reñaca'), 'vina-del-mar--renaca');
  assert.equal(zonaRuta('Reñaca', 'Viña del Mar'), 'vina-del-mar--renaca');
  assert.equal(new Set(groups.map((g) => zonaRuta(g.zona, g.ciudad))).size, groups.length);
  assert.equal(encontrarZona(venues, 'renaca--renaca'), null, 'no artificial pseudo-municipality');
  assert.equal(encontrarZona(venues, 'vina-del-mar--renaca')?.ciudad, 'Viña del Mar');
  assert.equal(encontrarZona(venues, 'renaca')?.ciudad, 'Viña del Mar', 'legacy URL points to the official municipality');
  assert.equal(encontrarZona(venues, 'zona-inexistente'), null);
});

test('zonas: same municipality and zone still group venues', () => {
  const venues = [lugar('bar-uno', 'Valparaíso', 'Cerro Alegre'), lugar('bar-dos', 'Valparaíso', 'Cerro Alegre')];
  const groups = zonasDe(venues);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].lugares.length, 2);
  assert.equal(zonaRuta(groups[0].zona, groups[0].ciudad), 'valparaiso--cerro-alegre');
  assert.equal(encontrarZona(venues, 'cerro-alegre')?.lugares.length, 2);
});
