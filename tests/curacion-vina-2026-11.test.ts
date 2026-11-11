import { test } from 'node:test';
import assert from 'node:assert/strict';
import catalogo from '../data/catalogo-publico.json';
import feed from '../data/editorial-events.json';

const nuevos = feed.filter((evento) => evento.id.startsWith('curated-202611-'));

test('los eventos editoriales nuevos corresponden a recintos identificados, no a una productora', () => {
  assert.ok(nuevos.length >= 2);
  for (const evento of nuevos) {
    const local = catalogo.locales.find((l) => l.slug === evento.venue_id);
    assert.ok(local, `${evento.id}: recinto ausente del catálogo`);
    assert.equal(local.comuna, evento.city, `${evento.id}: error de comuna`);
    assert.ok(/^(19|20)\d{2}-\d{2}-\d{2}$/.test(evento.date));
    assert.equal(evento.review_decision, 'approved');
  }
});

test('cada evento nuevo tiene evidencia individual de ticketera, nunca portada ni cartelera genérica', () => {
  const vistas = new Set<string>();
  for (const evento of nuevos) {
    const url = new URL(evento.source_url);
    assert.equal(url.protocol, 'https:');
    assert.equal(url.hostname, 'www.portaldisc.com');
    assert.match(url.pathname, /^\/evento\/[a-z0-9-]+$/);
    assert.ok(!vistas.has(url.href), `evidencia reutilizada: ${url.href}`);
    vistas.add(url.href);
    assert.equal(evento.price_clp, null, 'precio dinámico no debe fingir disponibilidad futura');
  }
});

test('Okko conserva su comuna ya reconciliada y se distingue Manda Viña de Manda Reñaca', () => {
  const okko = catalogo.locales.find((l) => l.slug === 'okko-music-lab-renaca');
  assert.equal(okko?.comuna, 'Concón');
  assert.equal(catalogo.locales.find((l) => l.slug === 'manda-vina')?.comuna, 'Viña del Mar');
  assert.equal(catalogo.locales.find((l) => l.slug === 'manda-renaca')?.comuna, 'Reñaca');
});
