import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import catalogo from '../data/catalogo-publico-slugs.json';
import { leerVesti, vestiCompany } from '../lib/sources/adapters/vesti';
import { eventlyAgenda, leerEvently } from '../lib/sources/adapters/evently';
import { leerCinzano } from '../lib/sources/adapters/cinzano';
import { SOURCES } from '../lib/sources/registry';
import { afichePara, dispatchSources, dueSources } from '../lib/sources/dispatcher';
import { RUTAS_LOCALES, fuentesDeRutas, validarRutas, type RutasLocal } from '../lib/venue-routes';
import { separarExistentes, urlComparable } from '../lib/editorial-dedupe';
import { reporteCobertura, type EstadoFuente } from '../lib/coverage';
import type { Fetcher, SourceDefinition } from '../lib/sources/types';

// Recortes reales del 17-oct-2026 (solo los bloques que leen los adaptadores).
const fx = (n: string) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');
const HOY = '2026-10-17';

test('Vesti: la hora sale del instante UTC convertido a Chile, no del texto del servidor', () => {
  const r = leerVesti(fx('vesti-company-studio-valparaiso.html'), { id: 'ruta-vesti-studio', commune: 'Valparaíso', venueName: 'Studio Valparaíso' }, HOY);
  assert.equal(r.parseFailures, 0);
  assert.deepEqual(
    r.candidates.map((c) => [c.date, c.time]),
    [
      ['2026-10-17', '22:00'],
      ['2026-10-21', '22:00'],
      ['2026-10-31', '22:00'],
    ],
  );
  const [sabado] = r.candidates;
  assert.equal(sabado.detailUrl, 'https://vesti.cl/events/studio-valparaiso-r-presenta-super-sabad-o-sabado-17-octubre-2026');
  assert.equal(sabado.priceClp, 0);
  // "Desde $0" no se presenta como "Gratis": se manda a mirar la condición.
  assert.match(sabado.priceText || '', /^Desde \$0 en Vesti · revisa condiciones/);
  assert.ok(sabado.imageUrl?.startsWith('https://events-cdn.vesti.cl/'));
  assert.equal(sabado.confidence, 'high');
});

test('Vesti: un perfil sin fechas es una ruta vacía, no un error; una página rara sí lo es', () => {
  const vacio = leerVesti(fx('vesti-company-woo-club.html'), { id: 'x', commune: 'Valparaíso' }, HOY);
  assert.deepEqual([vacio.itemsFound, vacio.candidates.length], [0, 0]);
  assert.throws(() => leerVesti('<html>otra cosa</html>', { id: 'x', commune: 'Valparaíso' }, HOY), /PAGINA_INESPERADA/);
});

const paginas: Record<string, string> = {
  'https://wooclub.evently.cl/': 'evently-wooclub-mes.html',
  'https://wooclub.evently.cl/Sabawoo-x-Ley-C-Sale-17-10-2026': 'evently-wooclub-sabawoo-17-10-2026.html',
  'https://wooclub.evently.cl/Sabawoo-x-Ley-C-Sale-17-10-2026/tickets': 'evently-wooclub-sabawoo-17-10-2026-tickets.html',
};
function fetcherFixtures(pedidas: string[]): Fetcher {
  return async (u) => {
    pedidas.push(u);
    return paginas[u] ? { status: 200, body: fx(paginas[u]) } : { status: 404, body: '' };
  };
}
const woo = { id: 'ruta-evently-woo', publicUrl: 'https://wooclub.evently.cl/', commune: 'Valparaíso', venueName: 'Woo Club' };

test('Evently: la fecha de la URL se confirma con schema.org y los tickets dicen sus condiciones', async () => {
  const pedidas: string[] = [];
  const r = await leerEvently(woo, fetcherFixtures(pedidas), HOY);
  assert.equal(r.candidates.length, 1);
  const [c] = r.candidates;
  assert.deepEqual([c.date, c.time, c.confidence], ['2026-10-17', '22:30', 'high']);
  assert.equal(c.priceClp, 0);
  assert.match(c.priceText || '', /Ticket free mujeres sin costo \(Ticket válido hasta las 23:30hrs/);
  assert.match(c.priceText || '', /Ticket C\/Cover \$10\.000 \+ cargo/);
  // Pasadas y lejanas no se abren; la de Halloween no estaba en los recortes y queda anotada.
  assert.ok(pedidas.every((u) => !/-0[2-9]-10-2026|-09-2026/.test(u)));
  assert.deepEqual(r.diagnostics, ['DETAIL_HTTP_404=1']);
});

test('Evently: presupuesto de fichas y host exacto', async () => {
  const pedidas: string[] = [];
  const r = await leerEvently(woo, fetcherFixtures(pedidas), HOY, 0);
  assert.deepEqual([r.candidates.length, pedidas.length], [0, 1]);
  assert.deepEqual(r.diagnostics, ['DETAIL_BUDGET=2']);
  const otro: string[] = [];
  await assert.rejects(
    eventlyAgenda.run({ ...woo, publicUrl: 'https://otraproductora.evently.cl/' } as SourceDefinition, fetcherFixtures(otro)),
    /HOST_NO_PERMITIDO/,
  );
  await assert.rejects(
    vestiCompany.run({ publicUrl: 'https://vesti.cl.evil.example/company/x' } as SourceDefinition, fetcherFixtures(otro)),
    /HOST_NO_PERMITIDO/,
  );
  assert.equal(otro.length, 0, 'un host fuera de la lista no se pide nunca');
});

test('Cinzano: API oficial con precio y cargo; la disponibilidad no se inventa', () => {
  const json = JSON.parse(fx('cinzano-api-events-2026-10-17.json'));
  const r = leerCinzano(json, { id: 'cinzano-agenda', commune: 'Valparaíso', venueName: 'Bar Cinzano' }, HOY);
  const kitsch = r.candidates.find((c) => c.detailUrl === 'https://cinzanooficial.cl/evento/16183');
  assert.deepEqual([kitsch?.date, kitsch?.time, kitsch?.priceClp], ['2026-10-17', '21:00', 10000]);
  assert.equal(kitsch?.priceText, 'Entrada $10.000 + $1.000 cargo · sin venta en línea habilitada al revisar');
  assert.ok(kitsch?.reasons.some((x) => x.startsWith('AVAILABILITY_CONFLICT: estado "few-tickets" con stock 0')));
  const viernes = r.candidates.find((c) => c.date === '2026-10-23');
  assert.equal(viernes?.priceText, 'Entrada $10.000 + $1.000 cargo');
  assert.ok(r.candidates.every((c) => c.date >= HOY), 'mayo no vuelve');
});

test('rutas por local: forma válida, slugs del catálogo y hosts exactos', () => {
  assert.deepEqual(validarRutas(RUTAS_LOCALES), []);
  const slugs = new Set(catalogo.slugs);
  for (const l of RUTAS_LOCALES) assert.ok(slugs.has(l.slug), `${l.slug} no está en el catálogo público`);
  const malas: RutasLocal[] = [
    {
      slug: 'x-local',
      nombre: 'X',
      comuna: 'Valparaíso',
      rutas: [
        { tipo: 'evently_agenda', url: 'https://cualquiera.evently.cl/', acceso: 'auto', verificada: '2026-10-17' },
        { tipo: 'instagram', url: 'https://www.instagram.com/x/', acceso: 'auto', verificada: '2026-10-17' },
        { tipo: 'ecopass', url: 'https://www.ecopass.cl/', acceso: 'bloqueado', verificada: '2026-10-17' },
      ],
    },
  ];
  const errores = validarRutas(malas).join('\n');
  assert.match(errores, /cualquiera\.evently\.cl fuera de la lista exacta/);
  assert.match(errores, /instagram: sin adaptador/);
  assert.match(errores, /ecopass: un acceso manual o bloqueado necesita su motivo/);
});

test('las rutas automáticas entran al registro en cola privada y sin duplicar URLs', () => {
  const rutas = SOURCES.filter((s) => s.id.startsWith('ruta-'));
  assert.ok(rutas.length >= 3);
  assert.ok(rutas.every((s) => s.trust === 'review' && s.venueSlug));
  assert.equal(new Set(SOURCES.map((s) => s.id)).size, SOURCES.length);
  assert.equal(new Set(SOURCES.map((s) => s.publicUrl)).size, SOURCES.length);
  // Una ruta cuya URL ya está registrada no genera otra fuente.
  const ya = fuentesDeRutas([{ publicUrl: 'https://vesti.cl/company/studio-valparaiso' } as SourceDefinition]);
  assert.ok(!ya.some((s) => s.publicUrl === 'https://vesti.cl/company/studio-valparaiso'));
});

test('afiche: solo de un host permitido y con la ficha de origen como procedencia', () => {
  const ok = afichePara(
    { imageUrl: 'https://events-cdn.vesti.cl/2026/10/13/b0b52610-f684-4ce4-a639-40040282b3fa.png', detailUrl: 'https://vesti.cl/events/x' },
    { sourceType: 'VESTI' },
  );
  assert.equal(ok?.image_source_url, 'https://vesti.cl/events/x');
  assert.equal(ok?.image_kind, 'ticketera');
  assert.equal(afichePara({ imageUrl: 'https://evil.example/a.png', detailUrl: 'https://vesti.cl/events/x' }, { sourceType: 'VESTI' }), null);
  assert.equal(afichePara({ imageUrl: null, detailUrl: 'https://vesti.cl/events/x' }, { sourceType: 'VESTI' }), null);
});

test('editorial: misma ficha y fecha en cualquier estado no se inserta ni se reactiva', () => {
  const competa = { instagram_id: 'curated-20261017-competa-atril-azul', instagram_url: 'https://www.portaldisc.com/evento/competaenatrilazul', date_text: '2026-10-17' };
  const otra = { instagram_id: 'curated-20261021-studio-noches-m', instagram_url: 'https://vesti.cl/events/noches-m', date_text: '2026-10-21' };
  const { nuevas, omitidas } = separarExistentes(
    [competa, otra],
    [
      // El caso real: en cola privada desde el listado regional, con otra clave.
      { id: 9001, instagram_id: 'src-portaldisc-region-2026-10-17-competa-en-atril-azul', date_text: '2026-10-17', instagram_url: 'https://portaldisc.com/evento/competaenatrilazul/', source_detail_url: null, disposition: 'review', moderation_status: 'pending' },
      // Rechazada en otra fecha: no bloquea la del 21 (otra URL), y nunca se toca.
      { id: 9002, instagram_id: 'src-x', date_text: '2026-10-21', instagram_url: 'https://vesti.cl/events/otro', source_detail_url: null, disposition: 'rejected', moderation_status: 'rejected' },
    ],
  );
  assert.deepEqual(nuevas.map((n) => n.instagram_id), ['curated-20261021-studio-noches-m']);
  assert.deepEqual(omitidas, [{ instagram_id: competa.instagram_id, existente: 9001, estado: 'review/pending' }]);
  const rechazada = separarExistentes([otra], [{ id: 7, instagram_id: 'src-y', date_text: '2026-10-21', instagram_url: null, source_detail_url: 'https://vesti.cl/events/noches-m', disposition: 'rejected', moderation_status: 'rejected' }]);
  assert.equal(rechazada.nuevas.length, 0, 'una ficha rechazada no vuelve por el editorial');
  assert.equal(urlComparable('https://www.portaldisc.com/evento/a/'), urlComparable('http://portaldisc.com/evento/a'));
  assert.notEqual(urlComparable('https://portaldisc.com/evento/a'), urlComparable('https://portaldisc.com/evento/b'));
});

test('cobertura: encontrado, ruta vacía, bloqueo y revisión vencida se distinguen', () => {
  const ahora = new Date('2026-10-17T19:00:00Z');
  const reciente = '2026-10-17T18:05:00Z';
  const estados = new Map<string, EstadoFuente>([
    ['ruta-evently-agenda-woo-club-valparaiso-osm', { revisadaEn: reciente, ok: true, error: null, fechas: ['2026-10-17', '2026-10-31'] }],
    ['ruta-vesti-company-woo-club-valparaiso-osm', { revisadaEn: reciente, ok: true, error: null, fechas: [] }],
    ['portaldisc-espantapajaros', { revisadaEn: reciente, ok: true, error: null, fechas: [] }],
    ['portaldisc-panichouse', { revisadaEn: '2026-10-10T18:00:00Z', ok: true, error: null, fechas: ['2026-10-23'] }],
  ]);
  const r = reporteCobertura(estados, '2026-10-17', { ahora });
  const local = (slug: string) => r.locales.find((l) => l.slug === slug)!;
  assert.equal(local('woo-club-valparaiso-osm').estado, 'FOUND');
  assert.deepEqual(local('woo-club-valparaiso-osm').fechas, ['2026-10-17'], 'solo la ventana de 7 días');
  assert.equal(local('espantapajaros-karaoke').estado, 'NO_ANNOUNCEMENT_FOUND');
  assert.equal(local('pagano-club').estado, 'BLOCKED');
  assert.equal(local('panic-house').estado, 'PENDING', 'una revisión de hace una semana no cuenta');
  assert.deepEqual(r.porDia['2026-10-17'], ['woo-club-valparaiso-osm']);
  assert.equal(r.resumen.locales, r.locales.length);
});

test('rotación: con 16 fuentes por día, toda fuente activa se lee dentro de su ciclo', () => {
  const activas = SOURCES.map((s) => s.id);
  const presupuesto = 16;
  const ultima = new Map<string, number>();
  const filas = SOURCES.map((s) => ({ id: s.id, active: true, next_check_at: '2026-10-17T00:00:00.000Z', last_checked_at: null as string | null }));
  const dias = Math.ceil(activas.length / presupuesto) + 1;
  for (let d = 0; d < dias * 3; d++) {
    const ahora = new Date(Date.UTC(2026, 9, 17 + d, 18));
    const hoy = dueSources(filas, ahora, presupuesto);
    assert.ok(hoy.length <= presupuesto);
    for (const s of hoy) {
      const f = filas.find((x) => x.id === s.id)!;
      f.last_checked_at = ahora.toISOString();
      f.next_check_at = new Date(ahora.getTime() + s.refreshHours * 3600_000).toISOString();
      ultima.set(s.id, d);
    }
    if (d === dias - 1) assert.deepEqual(activas.filter((id) => !ultima.has(id)), [], `en ${dias} días se leyeron todas`);
  }
  // Ninguna fuente espera más que su refresco más el ciclo completo.
  const max = Math.max(...SOURCES.map((s) => s.refreshHours / 24)) + dias;
  for (const id of activas) assert.ok(dias * 3 - 1 - (ultima.get(id) ?? -99) <= max, id);
});

test('plazo: las fuentes que no alcanzan a empezar quedan vencidas para la próxima corrida', async () => {
  // Base falsa: todo responde vacío y todas las fuentes figuran vencidas.
  const filas = SOURCES.map((s) => ({ id: s.id, active: true, next_check_at: '2026-10-01T00:00:00.000Z', last_checked_at: null }));
  const cadena = (tabla: string, op = '') => {
    const p: Record<string, unknown> = {};
    const self = new Proxy(p, {
      get(_, k) {
        if (k === 'then') return (res: (v: unknown) => void) => res({ data: tabla === 'event_sources' && op === 'select' ? filas : [], error: null });
        return (..._args: unknown[]) => cadena(tabla, op || String(k));
      },
    });
    return self;
  };
  const db = { from: (t: string) => cadena(t) };
  let t = 0;
  const actualizadas: string[] = [];
  const r = await dispatchSources(db, 5, async () => ({ status: 503, body: '' }), new Date('2026-10-17T18:00:00Z'), {
    plazoMs: 180_000,
    reloj: () => (t += 100_000),
  });
  assert.equal(r.due, 5);
  assert.equal(r.ran, 1);
  assert.equal(r.postergadas.length, 4);
  assert.equal(actualizadas.length, 0);
});
