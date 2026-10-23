import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INTENCIONES, intencionDeBusqueda, intencionPorSlug } from '../lib/intenciones';
import { esComedia } from '../lib/comedia';
import { cuantos, eventosLista, lugarObjeto, type Contexto, type Modo } from '../lib/resultados';
import { recomendar, type Candidato } from '../lib/recomendar';
import { precioCorto } from '../lib/precio';
import { parseFilters } from '../lib/filters';
import { ahoraEnChile } from '../lib/temporal';
import type { Evento } from '../lib/types';
import type { Lugar } from '../lib/venues';

const HOY = '2026-10-23'; // viernes
const L = (slug: string, ciudad: string, tipo: string, tags: string[] = [], lat = -33.04, lng = -71.62, nombre = slug) =>
  ({ slug, nombre, ciudad, tipo, tags, lat, lng }) as unknown as Lugar;
const lugares = [
  L('club-valpo', 'Valparaíso', 'discoteca', ['fiesta']),
  L('club-vina', 'Viña del Mar', 'discoteca', [], -33.02, -71.55),
  L('bar-quilpue', 'Quilpué', 'bar', ['cerveza'], -33.047, -71.44),
  L('disco-quilpue', 'Quilpué', 'club', [], -33.048, -71.441),
  L('sala-valpo', 'Valparaíso', 'sala-en-vivo', ['en-vivo']),
  L('miaw', 'Valparaíso', 'bar', ['bar', 'terraza', 'en-vivo', 'karaoke', 'comedia']),
  L('barbones', 'Viña del Mar', 'sala-en-vivo', [], -33.02, -71.55, 'Barbones Comedy'),
  L('karaoke-valpo', 'Valparaíso', 'karaoke', ['karaoke', 'bar']),
  L('bar-cerca', 'Valparaíso', 'bar', [], -33.0438, -71.6285),
  L('bar-lejos', 'Valparaíso', 'bar', [], -33.06, -71.6),
];
const E = (id: string, lugar: string, extra: Partial<Evento> = {}) =>
  ({ id, nombre: `Noche ${id}`, descripcion: '', fecha: HOY, hora: '22:00', activo: true, categoria: 'otro', tipo: 'main', lugar, ciudad: lugares.find((l) => l.slug === lugar)!.ciudad, precio: 0, precio_conocido: false, precio_texto: null, confianza: 'ticketera', fuente_url: null, ...extra }) as unknown as Evento;
const eventos = [
  E('fiesta-valpo', 'club-valpo', { tipo: 'club' }),
  E('fiesta-vina', 'club-vina', { tipo: 'club' }),
  E('fiesta-quilpue', 'disco-quilpue', { categoria: 'reggaeton' }),
  E('concierto', 'sala-valpo', { tipo: 'concierto', precio: 5000, precio_conocido: true, precio_texto: '$5.000' }),
  E('rock-miaw', 'miaw', { tipo: 'concierto' }),
  E('standup', 'barbones', { nombre: 'Lucas Espinoza' }),
  E('comedypass', 'miaw', { nombre: 'Paola Molina', fuente_url: 'https://comedypass.online/tienda/paola' }),
  E('teatro', 'sala-valpo', { tipo: 'noche_cultural', nombre: 'Comedia dramática en tres actos' }),
  E('karaoke-sab', 'karaoke-valpo', { nombre: 'Noche de karaoke', fecha: '2026-10-24' }),
  E('chela-cerca', 'bar-cerca'),
  E('chela-lejos', 'bar-lejos', { precio: 3000, precio_conocido: true, precio_texto: '$3.000' }),
  E('chela-quilpue', 'bar-quilpue'),
];
const lugarDe = (e: Pick<Evento, 'lugar'>) => e.lugar || null;
const ctx = (now = { fecha: HOY, minutos: 20 * 60 }): Contexto => ({ todos: eventos, lugares, today: now.fecha, ahora: now, lugarDe, sectorDe: () => null });
const lista: Modo = { vista: 'lista', ver: 'todo', capa: 'hoy' };
const ids = (f: Parameters<typeof eventosLista>[1], c = ctx()) => eventosLista(c, f).map((e) => e.id).sort();
const cand = (c: Contexto, f: Parameters<typeof eventosLista>[1]): Candidato[] =>
  eventosLista(c, f).map((e) => {
    const l = lugarObjeto(c, e);
    return { e, calce: intencionPorSlug(f.plan)?.evento(e, l) || 'exacto', lugar: l?.slug || null, sector: null, pos: l ? { lat: l.lat!, lng: l.lng! } : null };
  });

test('intenciones V1: siete, con slug, label, descripción, icono y reglas', () => {
  assert.deepEqual(INTENCIONES.map((i) => i.slug), ['bailar', 'tomar-algo', 'musica-en-vivo', 'karaoke', 'comedia', 'tranqui', 'sorprendeme']);
  for (const i of INTENCIONES) assert.ok(i.label && i.descripcion && i.icono && typeof i.evento === 'function' && typeof i.lugar === 'function', i.slug);
});

test('Bailar + hoy + Valparaíso; Bailar + Quilpué: comuna estricta', () => {
  assert.deepEqual(ids({ plan: 'bailar', fecha: 'hoy', ciudad: 'Valparaíso' }), ['fiesta-valpo']);
  assert.deepEqual(ids({ plan: 'bailar', fecha: 'futuro', ciudad: 'Quilpué' }), ['fiesta-quilpue']);
});

test('Música en vivo + hoy: conciertos, nunca comedia ni teatro', () => {
  assert.deepEqual(ids({ plan: 'musica-en-vivo', fecha: 'hoy' }), ['concierto', 'rock-miaw']);
  const foto = E('foto', 'club-vina', { tipo: 'festival', nombre: 'Festival Internacional de Fotografía' });
  assert.equal(intencionPorSlug('musica-en-vivo')!.evento(foto, null), false, 'un festival de fotografía no es música en vivo');
});

test('Comedia: clasificación canónica, no regex suelta', () => {
  assert.deepEqual(ids({ plan: 'comedia', fecha: 'futuro' }), ['comedypass', 'standup']);
  const teatro = eventos.find((e) => e.id === 'teatro')!;
  assert.equal(esComedia(teatro, lugares.find((l) => l.slug === 'sala-valpo')), false, '"comedia dramática" no es stand-up');
  const rock = eventos.find((e) => e.id === 'rock-miaw')!;
  assert.equal(esComedia(rock, lugares.find((l) => l.slug === 'miaw')), false, 'un bar con comedia y bandas no vuelve comedia todo');
  assert.equal(esComedia({ nombre: '2° Festival de Stand Up Comedy', descripcion: '', lugar: 'PCdV', fuente_url: null }), true);
  assert.equal(esComedia({ nombre: 'X', descripcion: '', lugar: null, fuente_url: 'https://backend.comediaticket.cl/x' }), true);
});

test('Karaoke + finde', () => {
  assert.deepEqual(ids({ plan: 'karaoke', fecha: 'finde' }), ['karaoke-sab']);
  assert.deepEqual(ids({ plan: 'karaoke', fecha: 'hoy' }), [], 'el concierto en un bar con karaoke no es karaoke');
});

test('Tomar algo + Cerca de mí: lo más cerca primero, con distancia como razón', () => {
  const c = ctx();
  const yo = { lat: -33.0437, lng: -71.6284 };
  const r = recomendar(cand(c, { plan: 'tomar-algo', fecha: 'hoy' }), { ahora: c.ahora, today: HOY, yo });
  assert.equal(r[0].e.id, 'chela-cerca');
  assert.match(r[0].razones[0], /^A \d/);
  assert.ok(r.findIndex((x) => x.e.id === 'chela-lejos') < r.findIndex((x) => x.e.id === 'chela-quilpue'));
});

test('comuna manual + GPS distinto: la comuna manda', () => {
  const f = parseFilters(new URLSearchParams('plan=tomar-algo&cerca=1&ciudad=Quilpu%C3%A9&fecha=hoy'));
  assert.equal(f.cerca, false);
  assert.deepEqual(ids(f), ['chela-quilpue']);
});

test('Sorpréndeme: variado, sin repetir lugar ni tipo de noche al inicio', () => {
  const c = ctx();
  const r = recomendar(cand(c, { plan: 'sorprendeme', fecha: 'hoy' }), { ahora: c.ahora, today: HOY, diverso: true });
  assert.ok(r.length >= 3 && r.length <= 6);
  assert.equal(new Set(r.map((x) => x.e.lugar)).size, r.length);
});

test('shortlist: 0, 1 y 20 resultados; máximo 6; un lugar no copa la lista', () => {
  const c = ctx();
  assert.equal(recomendar(cand(c, { plan: 'karaoke', fecha: 'hoy' }), { ahora: c.ahora, today: HOY }).length, 0);
  assert.equal(recomendar(cand(c, { plan: 'bailar', fecha: 'hoy', ciudad: 'Valparaíso' }), { ahora: c.ahora, today: HOY }).length, 1);
  const veinte = Array.from({ length: 20 }, (_, i) => E(`v${i}`, i % 2 ? 'club-valpo' : 'club-vina', { tipo: 'club' }));
  const c20: Contexto = { ...c, todos: veinte };
  const r = recomendar(cand(c20, { plan: 'bailar', fecha: 'hoy' }), { ahora: c.ahora, today: HOY });
  assert.ok(r.length <= 6);
  for (const v of ['club-valpo', 'club-vina']) assert.ok(r.filter((x) => x.e.lugar === v).length <= 2, v);
  // "Ver todas las N opciones": N es la lista completa con los mismos filtros.
  assert.equal(cuantos(c20, { plan: 'bailar', fecha: 'hoy' }, lista), 20);
});

test('madrugada: el sábado 23:00 a las 02:00 sigue "esta noche" y se explica como "Ya empezó"', () => {
  const sab: Contexto = { ...ctx(), todos: [E('after', 'club-valpo', { tipo: 'club', fecha: '2026-10-24', hora: '23:00' })], today: '2026-10-24', ahora: ahoraEnChile(new Date('2026-10-25T05:00:00Z')) };
  const r = recomendar(cand(sab, { plan: 'bailar', fecha: 'hoy' }), { ahora: sab.ahora, today: sab.today, madrugada: true });
  assert.deepEqual(r[0].razones.slice(0, 1), ['Ya empezó']);
});

test('razones verificables: nunca "popular", "el mejor" ni ambiente', () => {
  const c = ctx();
  const todas = recomendar(cand(c, { plan: 'sorprendeme', fecha: 'futuro' }), { ahora: c.ahora, today: HOY, diverso: true }).flatMap((x) => x.razones);
  for (const r of todas) assert.doesNotMatch(r, /popular|mejor|ideal|ambiente|prendid/i);
});

test('URL: compartir/recargar/atrás recrean la selección', () => {
  const f = parseFilters(new URLSearchParams('plan=bailar&fecha=hoy&ciudad=Valpara%C3%ADso'));
  assert.deepEqual([f.plan, f.fecha, f.ciudad, f.cerca], ['bailar', 'hoy', 'Valparaíso', false]);
  assert.equal(parseFilters(new URLSearchParams('plan=inventada')).plan, null);
  assert.equal(parseFilters(new URLSearchParams('cerca=1')).cerca, true);
});

test('buscador: una palabra inequívoca ofrece la intención; lo demás sigue siendo búsqueda libre', () => {
  assert.equal(intencionDeBusqueda('Bailar')?.slug, 'bailar');
  assert.equal(intencionDeBusqueda('stand up')?.slug, 'comedia');
  assert.equal(intencionDeBusqueda('bailarina'), null);
  assert.equal(intencionDeBusqueda('Cerro Alegre'), null);
});

test('precio corto: Gratis solo sin condiciones, Desde solo si la fuente lo dice, agotado no es precio', () => {
  assert.equal(precioCorto({ precio: 5000, precio_conocido: true, precio_texto: '$5.000 + cargo' }).texto, '$5.000');
  assert.equal(precioCorto({ precio: 8000, precio_conocido: true, precio_texto: 'Desde $8.000 + cargo' }).texto, 'Desde $8.000');
  assert.equal(precioCorto({ precio: 0, precio_conocido: true, precio_texto: 'Entrada liberada' }).texto, 'Gratis');
  assert.equal(precioCorto({ precio: 0, precio_conocido: true, precio_texto: 'Invitación hasta 23:00 · después $10.000' }).texto, 'Gratis con condiciones');
  assert.equal(precioCorto({ precio: 0, precio_conocido: false, precio_texto: 'Agotado en Cinzano' }).tipo, 'agotado');
  // Textos reales del 23-oct: condiciones escritas en palabras.
  for (const t of [
    'Invitación sin costo con inscripción previa. válida hasta las 23:00; cupos limitados.',
    'Tickets De Cortesía Válidos Hasta Las 23 Hrs sin costo (Mayores De 18 Años)',
    'Ticket free mujeres sin costo (Ticket válido hasta las 00:00hrs presentando cédula de identidad y pase universitario)',
    'Desde $0 en Vesti · revisa condiciones de acceso en la ficha',
  ])
    assert.equal(precioCorto({ precio: 0, precio_conocido: true, precio_texto: t }).texto, 'Gratis con condiciones', t);
  for (const t of ['Entrada gratuita: gratis', 'Ticket gratis descarga tu entrada gratis', 'Entrada liberada'])
    assert.equal(precioCorto({ precio: 0, precio_conocido: true, precio_texto: t }).texto, 'Gratis', t);
  assert.equal(precioCorto({ precio: 0, precio_conocido: false, precio_texto: null }).texto, 'Precio por confirmar');
});
