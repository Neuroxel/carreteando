#!/usr/bin/env node
// El plan Free de Supabase no hace respaldos automáticos. Este script guarda una
// copia legible de lo que el sitio publica, sin necesitar la contraseña de la base.
// Para un volcado completo (incluida la cola privada) hace falta:
//   npx supabase db dump --db-url "postgresql://postgres:<clave>@db.<ref>.supabase.co:5432/postgres" -f respaldo.sql
import fs from 'node:fs';
import path from 'node:path';
const raiz = path.resolve(import.meta.dirname, '..');
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(raiz, '.env.local'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o la clave publicable en .env.local');
  process.exit(1);
}
const destino = process.argv[2] || path.join(raiz, 'docs', 'private', 'respaldos');
const sello = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const carpeta = path.join(destino, sello);
fs.mkdirSync(carpeta, { recursive: true, mode: 0o700 });
async function tabla(nombre, columnas) {
  const filas = [];
  for (let desde = 0; ; desde += 1000) {
    const r = await fetch(`${url}/rest/v1/${nombre}?select=${columnas}&limit=1000&offset=${desde}`, {
      headers: { apikey: key, Accept: 'application/json' },
    });
    if (!r.ok) throw new Error(`${nombre}: HTTP ${r.status}`);
    const lote = await r.json();
    filas.push(...lote);
    if (lote.length < 1000) break;
  }
  const archivo = path.join(carpeta, `${nombre}.json`);
  fs.writeFileSync(archivo, JSON.stringify(filas, null, 1), { mode: 0o600 });
  return filas.length;
}
const resumen = {};
for (const [nombre, columnas] of [
  ['venues', '*'],
  ['events', '*'],
]) {
  resumen[nombre] = await tabla(nombre, columnas);
  console.log(`${nombre}: ${resumen[nombre]} filas`);
}
fs.writeFileSync(
  path.join(carpeta, 'MANIFIESTO.json'),
  JSON.stringify(
    {
      tomado_en: new Date().toISOString(),
      alcance: 'Sólo filas públicas: lo que el sitio muestra. La cola privada y la auditoría necesitan un volcado con la contraseña de la base.',
      filas: resumen,
    },
    null,
    1,
  ),
  { mode: 0o600 },
);
console.log(`\nrespaldo en ${carpeta}`);
