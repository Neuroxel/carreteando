import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CLAVE_BIENVENIDA, INICIO, avanzar, debeMostrar, filtrosFinales, sesion } from '../lib/bienvenida';
import { parseFilters } from '../lib/filters';

const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('aparece solo en "/" limpio y una vez por sesión; nunca por URL compartida', () => {
  assert.equal(debeMostrar({ pathname: '/', search: '', hash: '', vista: false }), true, 'sesión nueva');
  assert.equal(debeMostrar({ pathname: '/', search: '?ciudad=Quilpu%C3%A9', hash: '', vista: false }), false, 'URL filtrada');
  assert.equal(debeMostrar({ pathname: '/', search: '', hash: '#cartelera', vista: false }), false);
  assert.equal(debeMostrar({ pathname: '/', search: '', hash: '', vista: true }), false, 'ya vista en la sesión');
  assert.equal(debeMostrar({ pathname: '/explorar', search: '', hash: '', vista: false }), false);
});

test('pasos: Qué → Dónde; Esta noche por defecto; Cambiar cuándo es opcional; volver', () => {
  assert.deepEqual([INICIO.paso, INICIO.fecha], ['que', 'hoy']);
  const dos = avanzar(INICIO, { tipo: 'elegir', plan: 'musica-en-vivo' });
  assert.deepEqual([dos.paso, dos.plan, dos.fecha], ['donde', 'musica-en-vivo', 'hoy']);
  const abierto = avanzar(dos, { tipo: 'cambiarCuando' });
  assert.equal(abierto.cambiandoCuando, true);
  const finde = avanzar(abierto, { tipo: 'cuando', fecha: 'finde' });
  assert.deepEqual([finde.fecha, finde.cambiandoCuando, finde.paso], ['finde', false, 'donde']);
  assert.equal(avanzar(dos, { tipo: 'volver' }).paso, 'que');
});

test('final: intención + dónde + cuándo → URL reproducible (recargar y compartir)', () => {
  const s = avanzar(INICIO, { tipo: 'elegir', plan: 'musica-en-vivo' });
  const f = filtrosFinales(s, { tipo: 'comuna', ciudad: 'Quilpué' });
  assert.deepEqual(f, { plan: 'musica-en-vivo', fecha: 'hoy', ciudad: 'Quilpué', cerca: false, zona: null });
  const url = new URLSearchParams({ plan: f.plan!, fecha: f.fecha, ciudad: f.ciudad });
  const r = parseFilters(url, 'hoy');
  assert.deepEqual([r.plan, r.fecha, r.ciudad, r.cerca], ['musica-en-vivo', 'hoy', 'Quilpué', false]);
  assert.deepEqual(filtrosFinales(s, { tipo: 'cerca' }), { plan: 'musica-en-vivo', fecha: 'hoy', ciudad: 'todos', cerca: true, zona: null });
  assert.equal(filtrosFinales(s, { tipo: 'region' }).ciudad, 'todos');
});

test('sessionStorage: marca y no reaparece; sin almacenamiento no insiste ni rompe', () => {
  const g = globalThis as { sessionStorage?: Storage };
  const datos = new Map<string, string>();
  g.sessionStorage = { getItem: (k: string) => datos.get(k) ?? null, setItem: (k: string, v: string) => void datos.set(k, v) } as Storage;
  assert.equal(sesion.vista(), false);
  sesion.marcar('omitida');
  assert.equal(datos.get(CLAVE_BIENVENIDA), 'omitida');
  assert.equal(sesion.vista(), true);
  g.sessionStorage = { getItem: () => { throw new Error('bloqueado'); }, setItem: () => { throw new Error('bloqueado'); } } as unknown as Storage;
  assert.equal(sesion.vista(), true);
  assert.doesNotThrow(() => sesion.marcar('vista'));
  delete g.sessionStorage;
});

test('la portada ya no trae el asistente embebido; la bienvenida es aparte y nunca atrapa', () => {
  const explore = src('components/ExploreClient.tsx');
  assert.doesNotMatch(explore, /asistente-pregunta|aria-label="Qué quieres hacer"|aria-label="Dónde"/);
  assert.doesNotMatch(explore, /<h2[^>]*>¿Qué quieres hacer\?/);
  // "Te recomendamos" solo con una intención (resultado de la bienvenida o enlace con ?plan=).
  assert.match(explore, /home && vista === 'lista' && ver !== 'lugares' && intencion && \(/);
  // "Ayúdame a elegir" la vuelve a abrir.
  assert.match(explore, /Ayúdame a elegir/);
  assert.match(explore, /onClick=\{\(\) => setBienvenida\(true\)\}/);
  // El final escribe una sola entrada de historial; los pasos no.
  const bienvenida = src('components/Bienvenida.tsx');
  assert.doesNotMatch(bienvenida, /history\.|pushState|router\./);
  assert.match(bienvenida, /Ver todo/);
  assert.match(bienvenida, /role="dialog" aria-modal="true"/);
  assert.match(bienvenida, /Escape/);
  // Saltar desde una home filtrada vuelve a la portada limpia.
  assert.match(explore, /const saltarBienvenida = useCallback\(\(\) => \{[\s\S]*?history\.pushState\(null, '', '\/'\)/);
  // "Cerca de mí" usa el mismo GPS (ubicar('gesto')), no otro.
  assert.match(explore, /if \(d\.tipo === 'cerca'\) ubicar\('gesto'\)/);
  assert.doesNotMatch(bienvenida, /geolocation/);
});

test('CSS: sin desborde y respeta movimiento reducido', () => {
  const css = src('app/globals.css');
  assert.match(css, /\.bienvenida-opciones \{ display:grid; grid-template-columns:repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /prefers-reduced-motion: reduce\) \{ \.bienvenida-paso \{ animation:none; \}/);
});
