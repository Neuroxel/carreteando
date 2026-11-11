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

test('zonas: a homonymous sector in different catalogue cities never merges venue lists', () => {
  const venues = [
    lugar('renaca-sector', 'Reñaca', 'Reñaca'),
    lugar('vina-renaca', 'Viña del Mar', 'Reñaca'),
    lugar('vina-centro', 'Viña del Mar', 'Viña Centro'),
    lugar('no-zone', 'Viña del Mar', null),
  ];
  const groups = zonasDe(venues);
  assert.equal(groups.length, 3);
  assert.deepEqual(groups.find((g) => g.ciudad === 'Reñaca')?.lugares.map((l) => l.slug), ['renaca-sector']);
  assert.deepEqual(groups.find((g) => g.ciudad === 'Viña del Mar' && g.zona === 'Reñaca')?.lugares.map((l) => l.slug), ['vina-renaca']);
  assert.equal(zonaRuta('Reñaca', 'Reñaca'), 'renaca--renaca');
  assert.equal(zonaRuta('Reñaca', 'Viña del Mar'), 'vina-del-mar--renaca');
  assert.equal(new Set(groups.map((g) => zonaRuta(g.zona, g.ciudad))).size, groups.length);
  assert.equal(encontrarZona(venues, 'renaca--renaca')?.ciudad, 'Reñaca');
  assert.equal(encontrarZona(venues, 'vina-del-mar--renaca')?.ciudad, 'Viña del Mar');
  assert.equal(encontrarZona(venues, 'renaca')?.ciudad, 'Reñaca', 'legacy URL prefers its namesake city');
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
