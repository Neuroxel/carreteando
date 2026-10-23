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
  assert.match(explore, /onCerca=\{\(\) => ubicar\('gesto'\)\}/);
  assert.doesNotMatch(bienvenida, /geolocation/);
});

test('CSS: sin desborde, safe area, 100dvh y movimiento reducido', () => {
  const css = src('app/globals.css');
  const bloque = css.slice(css.indexOf('Bienvenida "Afiche Vivo"'), css.indexOf('.ayuda-elegir {'));
  assert.match(bloque, /\.bienvenida \{[^}]*height:100dvh/);
  assert.match(bloque, /env\(safe-area-inset-bottom\)/);
  assert.match(bloque, /\.bv-muro \{ display:grid; grid-template-columns:repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(bloque, /overflow-x:hidden/);
  // Solo transform y opacity en las animaciones (nada de width/height/top/left ni blur).
  for (const kf of bloque.match(/@keyframes [\w-]+ \{[\s\S]*?\}\s*\}/g) || []) assert.doesNotMatch(kf, /width|height|top:|left:|blur|filter/, kf.slice(0, 40));
  // Movimiento reducido: sin escalas ni barridos, solo fundidos.
  const reducido = bloque.slice(bloque.indexOf('@media (prefers-reduced-motion: reduce)'));
  assert.match(reducido, /\.bv-fase-signo \.bv-signo \{ animation:none; \}/);
  assert.match(reducido, /\.bv-elegido[^{]*\{ animation:none; \}/);
  assert.match(reducido, /bv-fundido/);
});

test('?elegir=1 la abre a pedido y se consume sin perder el resto de la URL', async () => {
  const { leerElegir } = await import('../lib/bienvenida');
  assert.deepEqual(leerElegir('?elegir=1'), { forzar: true, search: '' });
  assert.deepEqual(leerElegir('?ciudad=Quilpu%C3%A9&elegir=1'), { forzar: true, search: '?ciudad=Quilpu%C3%A9' });
  assert.deepEqual(leerElegir('?ciudad=Quilpu%C3%A9'), { forzar: false, search: '?ciudad=Quilpu%C3%A9' });
  assert.deepEqual(leerElegir(''), { forzar: false, search: '' });
  const explore = src('components/ExploreClient.tsx');
  assert.match(explore, /if \(forzar\) history\.replaceState/);
});

test('doble toque: una elección se ejecuta una sola vez; volver no corre mientras anima', () => {
  const uno = avanzar(INICIO, { tipo: 'tocar', plan: 'bailar' });
  assert.equal(uno.bloqueado, true);
  const doble = avanzar(uno, { tipo: 'tocar', plan: 'comedia' });
  assert.equal(doble.plan, 'bailar', 'el segundo toque se ignora');
  assert.equal(avanzar(uno, { tipo: 'volver' }), uno, 'volver no corre durante la transición');
  const dos = avanzar(uno, { tipo: 'elegir', plan: 'bailar' });
  assert.deepEqual([dos.paso, dos.bloqueado], ['donde', false]);
  // El componente también corta con una referencia sincrónica (dos toques en el mismo frame).
  const b = src('components/Bienvenida.tsx');
  assert.match(b, /if \(ocupado\.current\) return;\s*ocupado\.current = true;/);
  // Sin animación igual funciona: los tiempos reducidos llegan al mismo final.
  assert.match(b, /TIEMPOS_REDUCIDOS = \{ golpe: 0, giro: 120/);
});

test('sin destello: el telón se pone solo cuando la bienvenida va a abrir', async () => {
  const { SCRIPT_SIN_DESTELLO } = await import('../lib/bienvenida');
  const correr = (search: string, hash = '', guardado: string | null = null, pathname = '/') => {
    const clases = new Set<string>();
    const env = {
      location: { pathname, search, hash },
      sessionStorage: { getItem: () => guardado },
      document: { documentElement: { classList: { add: (c: string) => clases.add(c), remove: (c: string) => clases.delete(c) } } },
      setTimeout: () => 0,
    };
    new Function('location', 'sessionStorage', 'document', 'setTimeout', SCRIPT_SIN_DESTELLO)(env.location, env.sessionStorage, env.document, env.setTimeout);
    return clases.has('bv-pendiente');
  };
  assert.equal(correr(''), true, 'primera visita limpia: se tapa antes de pintar');
  assert.equal(correr('', '', 'vista'), false, 'ya vista: portada normal');
  assert.equal(correr('?ciudad=Quilpu%C3%A9'), false, 'URL filtrada: nunca');
  assert.equal(correr('?elegir=1', '', 'vista'), true, 'a pedido');
  assert.equal(correr('', '#cartelera'), false);
  assert.equal(correr('', '', null, '/explorar'), false);
  assert.match(src('app/layout.tsx'), /dangerouslySetInnerHTML=\{\{ __html: SCRIPT_SIN_DESTELLO \}\}/);
  assert.match(src('components/Bienvenida.tsx'), /classList\.remove\('bv-pendiente'\)/);
  assert.match(src('components/ExploreClient.tsx'), /else document\.documentElement\.classList\.remove\('bv-pendiente'\)/);
});

test('afiches, no pills: el muro usa tarjetas y el "?" de la marca hace la transición', () => {
  const b = src('components/Bienvenida.tsx');
  assert.match(b, /className=\{claseAfiche/);
  assert.doesNotMatch(b, /asistente-chip|chip-n/);
  assert.match(b, /<path className="bv-signo-tinta" d=\{Q\}/);
  assert.match(b, /Dos toques y te mostramos dónde ir\./);
  assert.match(b, /Buscando qué hay cerca…/);
  assert.match(b, /Otras comunas/);
});

test('build: una caída momentánea de la base no tumba el deploy por el sitemap', () => {
  const s = src('app/sitemap.ts');
  assert.match(s, /if \(process\.env\.NEXT_PHASE === 'phase-production-build'\) return fijas;\s*throw new Error\('SITEMAP_BACKEND_UNAVAILABLE'\)/);
});

test('3D: carta de dos caras (¿Qué? / ¿Dónde?), cara oculta inerte, giro y alejamiento sin librerías', () => {
  const b = src('components/Bienvenida.tsx');
  assert.match(b, /bv-cara bv-frente" aria-hidden=\{s\.paso !== 'que'\} inert=/);
  assert.match(b, /bv-cara bv-dorso" aria-hidden=\{s\.paso !== 'donde'\} inert=/);
  assert.match(b, /className=\{`bv-carta \$\{s\.paso === 'donde' \? 'bv-girada' : ''\}`\}/);
  assert.doesNotMatch(src('package.json'), /"three"|framer-motion/);
  const css = src('app/globals.css');
  const bloque = css.slice(css.indexOf('Bienvenida 3D'));
  assert.match(bloque, /\.bv-escena \{[^}]*perspective:1400px/);
  assert.match(bloque, /\.bv-carta \{[^}]*transform-style:preserve-3d/);
  assert.match(bloque, /\.bienvenida-marco \{ perspective:1200px/, 'el alejamiento necesita perspectiva en el padre');
  assert.match(bloque, /\.bv-cara \{[^}]*backface-visibility:hidden/);
  assert.match(bloque, /\.bv-dorso \{ transform:rotateY\(180deg\)/);
  for (const kf of bloque.match(/@keyframes [\w-]+ \{[\s\S]*?\}\s*\}/g) || []) assert.doesNotMatch(kf, /width|height|top:|left:|blur|filter/);
  // Movimiento reducido: sin giro ni alejamiento; caras alternadas por opacidad.
  const reducido = bloque.slice(bloque.indexOf('@media (prefers-reduced-motion: reduce)'));
  assert.match(reducido, /\.bv-carta, \.bv-carta\.bv-girada, \.bv-dorso, \.bv-cara \{ transform:none !important/);
  assert.match(reducido, /\.bv-carta:not\(\.bv-girada\) \.bv-dorso, \.bv-carta\.bv-girada \.bv-frente \{ opacity:0; visibility:hidden; \}/);
});
