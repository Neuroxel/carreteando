#!/usr/bin/env node
/**
 * El plan Free de Supabase no hace respaldos automáticos de ningún tipo.
 * Este script produce una copia fechada y dice exactamente qué cubre.
 *
 *   node scripts/respaldo.mjs
 *     → copia pública: lo que el sitio muestra. No necesita credenciales.
 *
 *   SUPABASE_SECRET_KEY=... node scripts/respaldo.mjs
 *     → copia completa de las tablas de datos, incluida la cola privada,
 *       la auditoría de moderación y el registro de fuentes.
 *
 * Ninguno de los dos reemplaza un volcado lógico con esquema. Para eso:
 *   npx supabase db dump --db-url "postgresql://postgres:<clave>@db.<ref>.supabase.co:5432/postgres" -f respaldo.sql
 * El esquema, además, vive versionado en supabase/migrations/.
 */
import fs from 'node:fs';
import path from 'node:path';
const raiz = path.resolve(import.meta.dirname, '..');
const env = { ...process.env };
for (const linea of fs.readFileSync(path.join(raiz, '.env.local'), 'utf8').split('\n')) {
  if (!linea.includes('=') || linea.startsWith('#')) continue;
  const i = linea.indexOf('=');
  const k = linea.slice(0, i).trim();
  if (!env[k]) env[k] = linea.slice(i + 1).trim();
}
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const servicio = env.SUPABASE_SECRET_KEY || '';
const publica = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const key = servicio || publica;
if (!url || !key) {
  console.error('Falta NEXT_PUBLIC_SUPABASE_URL o una clave en .env.local');
  process.exit(1);
}
const completo = Boolean(servicio);
// Con la clave de servicio se alcanzan las tablas privadas; sin ella, sólo las
// filas que cualquier visitante podría ver de todos modos.
const TABLAS = completo
  ? ['venues', 'events', 'community_inbox', 'review_audit', 'event_sources', 'ingestion_source_runs', 'ingestion_runs', 'metrics_daily', 'live_reports']
  : ['venues', 'events'];
const destino = process.argv[2] || path.join(raiz, 'docs', 'private', 'respaldos');
const sello = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const carpeta = path.join(destino, sello);
fs.mkdirSync(carpeta, { recursive: true, mode: 0o700 });
const cabeceras = { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' };
async function tabla(nombre) {
  const filas = [];
  for (let desde = 0; ; desde += 1000) {
    const r = await fetch(`${url}/rest/v1/${nombre}?select=*&limit=1000&offset=${desde}`, {
      headers: cabeceras,
    });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`${nombre}: HTTP ${r.status}`);
    const lote = await r.json();
    filas.push(...lote);
    if (lote.length < 1000) break;
  }
  fs.writeFileSync(path.join(carpeta, `${nombre}.json`), JSON.stringify(filas, null, 1), {
    mode: 0o600,
  });
  return filas.length;
}
const resumen = {};
for (const nombre of TABLAS) {
  const n = await tabla(nombre);
  if (n === null) {
    console.log(`${nombre}: no accesible con esta clave`);
    continue;
  }
  resumen[nombre] = n;
  console.log(`${nombre}: ${n} filas`);
}
// El esquema viaja con el respaldo: sin él, los datos no se pueden restaurar.
const migraciones = path.join(raiz, 'supabase', 'migrations');
if (fs.existsSync(migraciones)) {
  fs.mkdirSync(path.join(carpeta, 'esquema'), { recursive: true, mode: 0o700 });
  for (const f of fs.readdirSync(migraciones))
    fs.copyFileSync(path.join(migraciones, f), path.join(carpeta, 'esquema', f));
}
fs.writeFileSync(
  path.join(carpeta, 'MANIFIESTO.json'),
  JSON.stringify(
    {
      tomado_en: new Date().toISOString(),
      alcance: completo
        ? 'Todas las tablas de datos, incluidas las privadas. NO incluye un volcado lógico con esquema: para restaurar hay que recrear el esquema desde supabase/migrations y luego cargar estos JSON.'
        : 'SÓLO filas públicas: lo que el sitio muestra. La cola privada, la auditoría y el registro de fuentes NO están aquí. Ejecuta con SUPABASE_SECRET_KEY para incluirlas.',
      completo,
      filas: resumen,
      esquema: fs.existsSync(migraciones) ? 'copiado desde supabase/migrations' : 'ausente',
      restaurar:
        'Crear un proyecto nuevo, aplicar las migraciones de esquema/ en orden, y cargar cada JSON en su tabla. El respaldo no se ha ensayado contra un proyecto vacío: hasta que se ensaye, considérelo sin verificar.',
    },
    null,
    1,
  ),
  { mode: 0o600 },
);
console.log(`\n${completo ? 'respaldo completo' : 'respaldo público (parcial)'} en ${carpeta}`);
