import { ADAPTERS, SOURCES } from './lib/sources/registry';
import { httpFetcher, decide } from './lib/sources/dispatcher';
import { detectCategory } from './lib/events';
import { toChileDateString } from './lib/event-extraction';
import fs from 'node:fs';
async function main() {
  const today = toChileDateString();
  const filas: Record<string, unknown>[] = [];
  const resumen: Record<string, unknown>[] = [];
  for (const source of SOURCES) {
    const t0 = Date.now();
    try {
      const r = await ADAPTERS[source.adapter].run(source, httpFetcher);
      let pub = 0, rev = 0, desc = 0;
      for (const c of r.candidates) {
        const { decision } = decide(c, source, today);
        if (decision === 'descartado') { desc++; continue; }
        if (decision === 'publicar') pub++; else rev++;
        filas.push({
          instagram_id: c.key, title: c.title, description: c.description,
          date_text: c.date, event_time: c.time, venue: c.venue, city: c.city,
          location: `${c.venue || source.name} · ${c.city}`,
          instagram_url: c.detailUrl, source_detail_url: c.detailUrl, image_url: c.imageUrl,
          price_clp: c.priceClp, price_text: c.priceText,
          category: detectCategory(`${c.title} ${c.description || ''}`),
          source: 'adapter', source_id: source.id, event_key: c.key,
          venue_slug: source.venueSlug || null,
          is_active: decision === 'publicar', moderation_status: decision === 'publicar' ? 'approved' : 'pending',
        });
      }
      resumen.push({ id: source.id, name: source.name, ms: Date.now() - t0, ok: true,
        items: r.itemsFound, candidatos: r.candidates.length, publicar: pub, revisar: rev,
        descartados: desc, fallos: r.parseFailures, error: null });
    } catch (e) {
      resumen.push({ id: source.id, name: source.name, ms: Date.now() - t0, ok: false,
        items: 0, candidatos: 0, publicar: 0, revisar: 0, descartados: 0, fallos: 0,
        error: (e as Error).message });
    }
  }
  fs.writeFileSync(process.argv[2], JSON.stringify({ today, filas, resumen }, null, 1));
  console.log('FUENTE'.padEnd(24), 'ms'.padStart(5), 'items'.padStart(6), 'cand'.padStart(5), 'pub'.padStart(4), 'rev'.padStart(4), 'desc'.padStart(5), 'fall'.padStart(5), ' error');
  for (const r of resumen)
    console.log(String(r.id).padEnd(24), String(r.ms).padStart(5), String(r.items).padStart(6),
      String(r.candidatos).padStart(5), String(r.publicar).padStart(4), String(r.revisar).padStart(4),
      String(r.descartados).padStart(5), String(r.fallos).padStart(5), ' ', r.error || '');
  console.log('\nfilas a escribir:', filas.length);
}
main();
