import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const APIFY_TOKEN = process.env.APIFY_API_TOKEN!;
const APIFY_ACTOR = 'apify~instagram-scraper';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Todas las cuentas monitoreadas (igual que scraper.py)
const VENUE_INFO: Record<string, { name: string; location: string; tier: string }> = {
  'el.huevo':                  { name: 'El Huevo Valparaíso',        location: 'Valparaíso (Blanco 1386)',      tier: 'mainstream' },
  'barelhuevo':                { name: 'El Huevo Bar',               location: 'Valparaíso (Blanco 1386)',      tier: 'mainstream' },
  'trotamundosvalpo':          { name: 'Trotamundos Terraza',        location: 'Valparaíso',                    tier: 'mainstream' },
  'clubtrotaquilpue':          { name: 'Trotamundos Quilpué',        location: 'Quilpué',                       tier: 'mainstream' },
  'terraza_bellavista_valpo':  { name: 'Terraza Bellavista',         location: 'Valparaíso (Blanco 1285)',      tier: 'mainstream' },
  'club_segundo_piso':         { name: 'Club Segundo Piso',          location: 'Valparaíso (Av. Brasil 1395)',  tier: 'under' },
  'mascara_valparaiso':        { name: 'Máscara Valparaíso',         location: 'Valparaíso (Plaza Aníbal Pinto)', tier: 'under' },
  'paganocl':                  { name: 'Pagano Club Lounge',         location: 'Valparaíso (Errázuriz 396)',    tier: 'under' },
  'espaciowarhola':            { name: 'Espacio Warhola',            location: 'Valparaíso (Esmeralda)',        tier: 'under' },
  'sala_rivoli':               { name: 'Sala Rívoli',                location: 'Valparaíso (Condell)',          tier: 'under' },
  'canchavalpo':               { name: 'Cancha Valparaíso',          location: 'Valparaíso',                    tier: 'under' },
  'barcivico':                 { name: 'Bar Cívico',                 location: 'Valparaíso (Blanco)',           tier: 'under' },
  'barlaplaya':                { name: 'Bar La Playa',               location: 'Valparaíso (Serrano)',          tier: 'under' },
  'valparaiso_techno':         { name: 'Valparaíso Techno',          location: 'Spot Secreto / Valparaíso',    tier: 'joyita' },
  'baptism_producciones':      { name: 'Baptism Producciones',       location: 'Valparaíso Under',              tier: 'joyita' },
  'distorsionsonora':          { name: 'Distorsión Sonora Raves',    location: 'Rave Clandestina / Valparaíso', tier: 'joyita' },
  'insomnia_teatro_condell':   { name: 'Teatro Condell Insomnia',    location: 'Condell 1585, Valparaíso',     tier: 'cultura' },
  'parqueculturaldevalparaiso':{ name: 'Parque Cultural ex Cárcel',  location: 'Cárcel 471, Cerro Cárcel',     tier: 'cultura' },
};

async function apifyRun(urls: string[]): Promise<any[]> {
  const runRes = await fetch(
    `https://api.apify.com/v2/acts/${APIFY_ACTOR}/runs?token=${APIFY_TOKEN}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        directUrls: urls,
        resultsType: 'posts',
        resultsLimit: 12,
        addParentData: false,
      }),
    }
  );
  if (!runRes.ok) return [];
  const { data } = await runRes.json();
  const runId: string = data.id;
  const datasetId: string = data.defaultDatasetId;

  // Esperar hasta SUCCEEDED (máx ~5 min)
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 7000));
    const statusRes = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`
    );
    if (!statusRes.ok) continue;
    const { data: s } = await statusRes.json();
    if (['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT'].includes(s.status)) {
      if (s.status !== 'SUCCEEDED') return [];
      break;
    }
  }

  const itemsRes = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&format=json&clean=true`
  );
  if (!itemsRes.ok) return [];
  const items = await itemsRes.json();
  return Array.isArray(items) ? items : (items.items ?? []);
}

function postToRow(item: any) {
  const username = ((item.ownerUsername || item.username) ?? '').toLowerCase().replace(/^@/, '');
  const meta = VENUE_INFO[username] ?? { name: `@${username}`, location: 'Valparaíso', tier: 'mainstream' };
  const caption: string = item.caption || item.alt || '';
  const shortcode: string = item.shortCode || item.id || '';
  if (!shortcode) return null;

  const isJoyita = meta.tier === 'joyita' ||
    /spot secreto|ubicación por dm|por interno|aporte voluntario|al sobre|galpón|casona|clandestin/i.test(caption);

  const firstLine = caption.split('\n').find((l) => l.trim().length > 3)?.trim() ?? `Evento en ${meta.name}`;
  let title = firstLine.substring(0, 110);
  if (isJoyita && !/^[💎🔥🔊]/.test(title)) title = `💎 ${title}`;

  let dateStr: string;
  try {
    const ts = item.timestamp || item.takenAt || '';
    dateStr = ts ? new Date(ts).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
  } catch {
    dateStr = new Date().toISOString().split('T')[0];
  }

  return {
    instagram_id: shortcode,
    title: title.substring(0, 130),
    description: caption.substring(0, 1000) || `Publicación de ${meta.name}`,
    date_text: dateStr,
    location: meta.location,
    image_url: item.displayUrl || item.thumbnailUrl || null,
    instagram_url: `https://www.instagram.com/p/${shortcode}/`,
    username,
    likes: Number(item.likesCount || item.likes || 0),
    scraped_at: new Date().toISOString(),
    source: isJoyita ? 'joyita_under' : meta.tier === 'mainstream' ? 'apify_instagram' : 'rave_techno',
    is_active: true,
  };
}

export const maxDuration = 300; // Vercel Pro: hasta 5 min

export async function GET(request: Request) {
  // Validar CRON_SECRET si está configurado
  const auth = request.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!APIFY_TOKEN) {
    return NextResponse.json({ error: 'APIFY_API_TOKEN no configurado' }, { status: 500 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const accounts = Object.keys(VENUE_INFO);
  const BATCH = 10;

  let totalPosts = 0;
  let totalSaved = 0;

  for (let i = 0; i < accounts.length; i += BATCH) {
    const batch = accounts.slice(i, i + BATCH);
    const urls = batch.map((u) => `https://www.instagram.com/${u}/`);
    const items = await apifyRun(urls);
    totalPosts += items.length;

    const rows = items.map(postToRow).filter(Boolean) as any[];

    // Deduplicar por instagram_id
    const seen = new Set<string>();
    const unique = rows.filter((r) => {
      if (seen.has(r.instagram_id)) return false;
      seen.add(r.instagram_id);
      return true;
    });

    if (unique.length > 0) {
      const { error } = await supabase
        .from('events')
        .upsert(unique, { onConflict: 'instagram_id' });
      if (!error) totalSaved += unique.length;
    }
  }

  return NextResponse.json({
    success: true,
    accounts_scanned: accounts.length,
    posts_found: totalPosts,
    events_saved: totalSaved,
    timestamp: new Date().toISOString(),
  });
}
