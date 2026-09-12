import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  extractEventDate,
  firstMeaningfulLine,
  isLikelyEventPost,
} from '../../../../lib/event-extraction';

const APIFY_TOKEN = process.env.APIFY_API_TOKEN;
const APIFY_ACTOR = process.env.APIFY_ACTOR || 'apify~instagram-scraper';
const APIFY_RESULTS_LIMIT = Math.max(1, Math.min(12, Number(process.env.APIFY_RESULTS_LIMIT || 5)));
const APIFY_NEWER_THAN = process.env.APIFY_NEWER_THAN || '3 days';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const VENUE_INFO: Record<string, { name: string; location: string; tier: string }> = {
  'el.huevo': { name: 'El Huevo Valparaíso', location: 'Valparaíso (Blanco 1386)', tier: 'mainstream' },
  'barelhuevo': { name: 'El Huevo Bar', location: 'Valparaíso (Blanco 1386)', tier: 'mainstream' },
  'trotamundosvalpo': { name: 'Trotamundos Terraza', location: 'Valparaíso', tier: 'mainstream' },
  'clubtrotaquilpue': { name: 'Trotamundos Quilpué', location: 'Quilpué', tier: 'mainstream' },
  'terraza_bellavista_valpo': { name: 'Terraza Bellavista', location: 'Valparaíso (Blanco 1285)', tier: 'mainstream' },
  'club_segundo_piso': { name: 'Club Segundo Piso', location: 'Valparaíso (Av. Brasil 1395)', tier: 'under' },
  'mascara_valparaiso': { name: 'Máscara Valparaíso', location: 'Valparaíso (Plaza Aníbal Pinto)', tier: 'under' },
  'paganocl': { name: 'Pagano Club Lounge', location: 'Valparaíso (Errázuriz 396)', tier: 'under' },
  'espaciowarhola': { name: 'Espacio Warhola', location: 'Valparaíso (Esmeralda)', tier: 'under' },
  'sala_rivoli': { name: 'Sala Rívoli', location: 'Valparaíso (Condell)', tier: 'under' },
  'canchavalpo': { name: 'Cancha Valparaíso', location: 'Valparaíso', tier: 'under' },
  'barcivico': { name: 'Bar Cívico', location: 'Valparaíso (Blanco)', tier: 'under' },
  'barlaplaya': { name: 'Bar La Playa', location: 'Valparaíso (Serrano)', tier: 'under' },
  'valparaiso_techno': { name: 'Valparaíso Techno', location: 'Valparaíso', tier: 'joyita' },
  'baptism_producciones': { name: 'Baptism Producciones', location: 'Valparaíso', tier: 'joyita' },
  'distorsionsonora': { name: 'Distorsión Sonora', location: 'Valparaíso', tier: 'joyita' },
  'insomnia_teatro_condell': { name: 'Teatro Condell Insomnia', location: 'Condell 1585, Valparaíso', tier: 'cultura' },
  'parqueculturaldevalparaiso': { name: 'Parque Cultural ex Cárcel', location: 'Cárcel 471, Valparaíso', tier: 'cultura' },
};

interface ApifyRun {
  id: string;
  defaultDatasetId: string;
}

async function apifyRequest(path: string, init?: RequestInit) {
  if (!APIFY_TOKEN) throw new Error('APIFY_API_TOKEN no configurado');

  const response = await fetch(`https://api.apify.com/v2/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${APIFY_TOKEN}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`Apify ${response.status}: ${detail || response.statusText}`);
  }

  return response.json();
}

async function runApify(urls: string[]): Promise<any[]> {
  const started = await apifyRequest(`acts/${APIFY_ACTOR}/runs`, {
    method: 'POST',
    body: JSON.stringify({
      directUrls: urls,
      resultsType: 'posts',
      resultsLimit: APIFY_RESULTS_LIMIT,
      onlyPostsNewerThan: APIFY_NEWER_THAN,
      addParentData: true,
    }),
  });

  const run = started?.data as ApifyRun | undefined;
  if (!run?.id || !run.defaultDatasetId) throw new Error('Apify no devolvió run/dataset válidos');

  let completed = false;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 7000));
    const statusPayload = await apifyRequest(`actor-runs/${run.id}`);
    const status = statusPayload?.data?.status as string | undefined;

    if (status === 'SUCCEEDED') {
      completed = true;
      break;
    }
    if (status && ['FAILED', 'ABORTED', 'TIMED-OUT'].includes(status)) {
      throw new Error(`Apify terminó con estado ${status}`);
    }
  }

  if (!completed) throw new Error('Apify excedió el tiempo de espera del cron');

  const items = await apifyRequest(`datasets/${run.defaultDatasetId}/items?format=json&clean=true`);
  return Array.isArray(items) ? items : [];
}

function getUsername(item: any): string {
  return String(
    item?.ownerUsername ||
      item?.username ||
      item?.owner?.username ||
      item?.parentData?.username ||
      '',
  )
    .toLowerCase()
    .replace(/^@/, '');
}

function getPublishedAt(item: any): string | number | null {
  return item?.timestamp || item?.takenAt || item?.takenAtIso || item?.publishedAt || null;
}

function postToRow(item: any) {
  const username = getUsername(item);
  const meta = VENUE_INFO[username] || {
    name: username ? `@${username}` : 'Evento V Región',
    location: 'Valparaíso',
    tier: 'mainstream',
  };

  const caption = String(item?.caption || item?.alt || '').trim();
  const shortcode = String(item?.shortCode || item?.id || '').trim();
  if (!shortcode || !caption) return null;

  const eventDate = extractEventDate(caption, getPublishedAt(item));
  if (!isLikelyEventPost(caption, eventDate)) return null;

  const isJoyita =
    meta.tier === 'joyita' ||
    /spot secreto|ubicaci[oó]n por dm|por interno|aporte voluntario|al sobre|galp[oó]n|casona|clandestin/i.test(caption);

  let title = firstMeaningfulLine(caption, `Evento en ${meta.name}`);
  if (isJoyita && !/^[💎🔥🔊]/.test(title)) title = `💎 ${title}`;

  return {
    instagram_id: shortcode,
    title,
    description: caption.slice(0, 4000),
    date_text: eventDate,
    location: meta.location,
    image_url: item?.displayUrl || item?.thumbnailUrl || item?.imageUrl || null,
    instagram_url: `https://www.instagram.com/p/${shortcode}/`,
    username,
    likes: Number(item?.likesCount || item?.likes || 0),
    scraped_at: new Date().toISOString(),
    source: isJoyita ? 'joyita_under' : meta.tier === 'mainstream' ? 'apify_instagram' : 'rave_techno',
    is_active: true,
  };
}

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (process.env.NODE_ENV === 'production' && !cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET no configurado' }, { status: 500 });
  }
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!APIFY_TOKEN || !SUPABASE_URL || !SUPABASE_KEY) {
    return NextResponse.json(
      { error: 'Faltan APIFY_API_TOKEN, NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY' },
      { status: 500 },
    );
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const accounts = Object.keys(VENUE_INFO);
    const urls = accounts.map((username) => `https://www.instagram.com/${username}/`);
    const items = await runApify(urls);

    const rows = items.map(postToRow).filter(Boolean) as Record<string, unknown>[];
    const unique = Array.from(new Map(rows.map((row: any) => [row.instagram_id, row])).values());

    if (unique.length > 0) {
      const { error } = await supabase.from('events').upsert(unique, { onConflict: 'instagram_id' });
      if (error) throw new Error(`Supabase upsert: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      accounts_scanned: accounts.length,
      posts_found: items.length,
      event_candidates: rows.length,
      events_saved: unique.length,
      skipped_non_events: items.length - rows.length,
      apify_results_limit_per_account: APIFY_RESULTS_LIMIT,
      apify_newer_than: APIFY_NEWER_THAN,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[cron/scrape]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconocido en scraping' },
      { status: 502 },
    );
  }
}
