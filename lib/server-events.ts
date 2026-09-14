import 'server-only';
import { cache } from 'react';
import { dbRowToEvento, EventRow } from './events';
import { toChileDateString } from './event-extraction';
import { Evento } from './types';
export type EventsResult =
  | { status: 'ok'; events: Evento[]; checkedAt: string }
  | { status: 'error'; events: []; checkedAt: string };
const COLUMNS =
  'instagram_id,title,description,date_text,location,image_url,instagram_url,username,scraped_at,source,is_active,moderation_status,source_published_at,last_verified_at,city,venue,address,event_time,price_clp,price_text,category,organizer_verified,event_type';
export async function readEvents(id?: string): Promise<EventsResult> {
  const checkedAt = new Date().toISOString();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { status: 'error', events: [], checkedAt };
  const query = new URLSearchParams({
    select: COLUMNS,
    is_active: 'eq.true',
    moderation_status: 'eq.approved',
    date_text: `gte.${toChileDateString(checkedAt)}`,
    order: 'date_text.asc,instagram_id.asc',
    limit: id ? '1' : '300',
  });
  if (id) query.set('instagram_id', `eq.${id}`);
  try {
    const response = await fetch(`${url}/rest/v1/events?${query}`, {
      headers: { apikey: key },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return { status: 'error', events: [], checkedAt };
    const rows: unknown = await response.json();
    if (!Array.isArray(rows)) return { status: 'error', events: [], checkedAt };
    const events = rows
      .map((row) => dbRowToEvento(row as EventRow))
      .filter((e): e is Evento => e !== null);
    // A successful [] is authoritative. Never resurrect browser or process caches.
    return { status: 'ok', events, checkedAt };
  } catch {
    return { status: 'error', events: [], checkedAt };
  }
}
export const getPublicEvents = cache(() => readEvents());
export const getPublicEvent = cache(async (id: string) =>
  /^[a-zA-Z0-9_-]{1,120}$/.test(id)
    ? readEvents(id)
    : ({ status: 'ok', events: [], checkedAt: new Date().toISOString() } as EventsResult),
);
