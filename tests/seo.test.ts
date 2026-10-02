import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dbRowToEvento } from '../lib/events';
import { eventJsonLd, safeJsonLd } from '../lib/event-seo';
test('structured data does not invent prices, availability, time or location; script safe', () => {
  const e = dbRowToEvento({
    instagram_id: 'abc',
    title: '</script><img src=x>',
    date_text: '2026-09-19',
    is_active: true,
    moderation_status: 'approved',
  })!;
  const schema = eventJsonLd(e);
  assert.equal('offers' in schema, false);
  assert.equal('location' in schema, false);
  assert.equal(schema.startDate, '2026-09-19');
  assert.equal(safeJsonLd(schema).includes('</script>'), false);
});

import { breadcrumbJsonLd, chileOffset, venueJsonLd } from '../lib/event-seo';
import { siteUrlFrom } from '../lib/site';
import { filterRobots } from '../lib/filter-seo';
import { indexNowPayload, INDEXNOW_KEY } from '../lib/indexnow';
import type { Lugar } from '../lib/venues';

test('la hora del evento lleva el desfase de Chile de esa fecha', () => {
  assert.equal(chileOffset('2026-10-10', '22:00'), '-03:00');
  assert.equal(chileOffset('2026-06-10', '22:00'), '-04:00');
  const e = dbRowToEvento({
    instagram_id: 'conhora',
    title: 'Noche',
    date_text: '2026-10-10',
    event_time: '22:00',
    venue: 'Cassot Bar',
    city: 'Valparaíso',
    is_active: true,
    moderation_status: 'approved',
  })!;
  const schema = eventJsonLd(e) as Record<string, unknown>;
  assert.equal(schema.startDate, '2026-10-10T22:00:00-03:00');
  assert.equal(schema.eventStatus, 'https://schema.org/EventScheduled');
});

test('el lugar declara su tipo y sus perfiles, sin coordenadas imprecisas ni reseñas', () => {
  const l = {
    slug: 'cassot-bar',
    nombre: 'Cassot Bar',
    ciudad: 'Valparaíso',
    zona: 'Subida Ecuador',
    direccion: 'Subida Ecuador 50',
    tipo: 'bar',
    tipo_label: 'Bar',
    tags: [],
    descripcion: null,
    sitio_url: null,
    instagram_url: 'https://www.instagram.com/cassotbar/',
    facebook_url: null,
    tiktok_url: null,
    contacto_url: null,
    agenda_url: null,
    estado: 'activo',
    imagen_url: null,
    fuente_tipo: 'ticketera',
    fuente_url: null,
    ultima_revision: null,
    lat: -33.04,
    lng: -71.62,
    precision_mapa: 'calle',
  } as Lugar;
  const schema = venueJsonLd(l) as Record<string, unknown>;
  assert.equal(schema['@type'], 'BarOrPub');
  assert.deepEqual(schema.sameAs, ['https://www.instagram.com/cassotbar/']);
  assert.equal('geo' in schema, false, 'precisión de calle no es una coordenada exacta');
  assert.equal('aggregateRating' in schema, false);
  assert.equal('openingHours' in schema, false);
  const exacta = venueJsonLd({ ...l, precision_mapa: 'exacta' }) as Record<string, unknown>;
  assert.ok('geo' in exacta);
});

test('migas de pan absolutas y en orden', () => {
  const b = breadcrumbJsonLd([
    { name: 'Inicio', path: '/' },
    { name: 'Cassot', path: '/lugar/cassot-bar' },
  ]);
  assert.equal(b.itemListElement[1].position, 2);
  assert.ok(b.itemListElement[1].item.endsWith('/lugar/cassot-bar'));
});

test('la dirección del sitio es configurable pero no rompible', () => {
  assert.equal(siteUrlFrom(undefined), 'https://carreteando.vercel.app');
  assert.equal(siteUrlFrom('https://carreteando.cl/'), 'https://carreteando.cl');
  assert.equal(siteUrlFrom('http://carreteando.cl'), 'https://carreteando.vercel.app');
  assert.equal(siteUrlFrom('https://carreteando.cl/algo'), 'https://carreteando.vercel.app');
  assert.equal(siteUrlFrom('no es url'), 'https://carreteando.vercel.app');
});

test('las URLs con filtros no se indexan; la limpia sí', () => {
  assert.deepEqual(filterRobots({}), {});
  assert.deepEqual(filterRobots({ fecha: '' }), {});
  assert.deepEqual(filterRobots({ fecha: 'hoy' }), { robots: { index: false, follow: true } });
});

test('IndexNow anuncia solo URLs propias, sin repetir y con la clave publicada', () => {
  const p = indexNowPayload(['/evento/a', '/evento/a', '/explorar']);
  assert.equal(p.urlList.length, 2);
  assert.ok(p.urlList.every((u) => u.startsWith('https://carreteando.vercel.app/')));
  assert.equal(p.key, INDEXNOW_KEY);
  assert.match(INDEXNOW_KEY, /^[a-f0-9]{32}$/);
  assert.ok(p.keyLocation.endsWith('/indexnow-key.txt'));
});
