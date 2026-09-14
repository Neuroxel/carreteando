import 'server-only';
import { cache } from 'react';
import { LiveRow, LiveSummary, summarizeLive } from './live-reports';
async function readLive(): Promise<Map<string, LiveRow[]>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const map = new Map<string, LiveRow[]>();
  if (!url || !key) return map;
  const query = new URLSearchParams({
    select: 'target_type,target_id,kind,value,created_at',
    order: 'created_at.desc',
    limit: '600',
  });
  try {
    const response = await fetch(`${url}/rest/v1/live_reports?${query}`, {
      headers: { apikey: key },
      cache: 'no-store',
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) return map;
    const rows: unknown = await response.json();
    if (!Array.isArray(rows)) return map;
    for (const r of rows as Record<string, string>[]) {
      if (!r?.target_type || !r?.target_id) continue;
      const k = `${r.target_type}:${r.target_id}`;
      (map.get(k) || map.set(k, []).get(k)!).push({
        kind: r.kind,
        value: r.value,
        created_at: r.created_at,
      });
    }
  } catch {
    /* Live status is a bonus: its absence must never break a page. */
  }
  return map;
}
export const getLiveReports = cache(readLive);
export async function liveFor(tipo: 'venue' | 'event', id: string): Promise<LiveSummary[]> {
  return summarizeLive((await getLiveReports()).get(`${tipo}:${id}`) || []);
}
