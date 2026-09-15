import fs from 'node:fs';
import { looksLikeSameEvent, normalizedTitle } from './lib/sources/dispatcher';
type Fila = Record<string, unknown>;
const run = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const existentes: { date_text: string; venue: string | null; title: string }[] = JSON.parse(
  fs.readFileSync(process.argv[3], 'utf8'),
);
const nuevos: Fila[] = [];
const dup: Fila[] = [];
const yaVistos = [...existentes];
for (const f of run.filas as Fila[]) {
  const fecha = String(f.date_text);
  const titulo = String(f.title);
  const venue = f.venue ? String(f.venue) : null;
  const choca = yaVistos.some((e) => {
    if (e.date_text !== fecha) return false;
    const mismoLugar = !venue || !e.venue || normalizedTitle(e.venue) === normalizedTitle(venue);
    return mismoLugar && looksLikeSameEvent(e.title, titulo);
  });
  if (choca) dup.push(f);
  else {
    nuevos.push(f);
    yaVistos.push({ date_text: fecha, venue, title: titulo });
  }
}
fs.writeFileSync(process.argv[4], JSON.stringify(nuevos, null, 1));
console.log(`candidatos: ${(run.filas as Fila[]).length}  nuevos: ${nuevos.length}  duplicados: ${dup.length}`);
console.log('\n--- NUEVOS ---');
for (const f of nuevos) console.log(' ', f.is_active ? 'PUB ' : 'COLA', f.date_text, String(f.venue || '?').slice(0, 24).padEnd(24), String(f.title).slice(0, 48));
console.log('\n--- DUPLICADOS SUPRIMIDOS ---');
for (const f of dup) console.log('  ', f.date_text, String(f.title).slice(0, 56));
