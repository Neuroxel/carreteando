import 'server-only';
import { cache } from 'react';
import { getAdminDb } from './server-db';
import { sourceFreshness, Freshness } from './freshness';
// Return only a public freshness state, never run IDs, errors, costs or private records.
export const getSourceFreshness = cache(async (): Promise<Freshness> => {
  try {
    const db = getAdminDb();
    if (!db) return 'unknown';
    const { data, error } = await db
      .from('ingestion_runs')
      .select('status,started_at,completed_at')
      .order('started_at', { ascending: false })
      .limit(1);
    return error ? 'unknown' : sourceFreshness(data?.[0] ?? null);
  } catch {
    return 'unknown';
  }
});
