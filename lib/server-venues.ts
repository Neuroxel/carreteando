import 'server-only';
import { cache } from 'react';
import { dbRowToLugar, Lugar, VenueRow } from './venues';
export type VenuesResult = { status: 'ok'; lugares: Lugar[] } | { status: 'error'; lugares: [] };
const COLUMNS =
  'slug,name,city,zone,address,venue_type,tags,description_short,official_url,instagram_url,calendar_url,image_url,source_type,source_url,last_verified_at,is_active,moderation_status';
async function readVenues(slug?: string): Promise<VenuesResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { status: 'error', lugares: [] };
  const query = new URLSearchParams({
    select: COLUMNS,
    is_active: 'eq.true',
    moderation_status: 'eq.approved',
    order: 'city.asc,name.asc',
    limit: slug ? '1' : '300',
  });
  if (slug) query.set('slug', `eq.${slug}`);
  try {
    const response = await fetch(`${url}/rest/v1/venues?${query}`, {
      headers: { apikey: key },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return { status: 'error', lugares: [] };
    const rows: unknown = await response.json();
    if (!Array.isArray(rows)) return { status: 'error', lugares: [] };
    return {
      status: 'ok',
      lugares: rows.map((r) => dbRowToLugar(r as VenueRow)).filter((l): l is Lugar => l !== null),
    };
  } catch {
    return { status: 'error', lugares: [] };
  }
}
export const getPublicVenues = cache(() => readVenues());
export const getPublicVenue = cache(async (slug: string) =>
  /^[a-z0-9-]{1,80}$/.test(slug)
    ? readVenues(slug)
    : ({ status: 'ok', lugares: [] } as VenuesResult),
);
