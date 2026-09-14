import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getAdminDb } from '../../../../lib/server-db';
import {
  boundedResultsLimit,
  classifyPost,
  classifySourceItem,
  ACTIVE_SOURCES,
  dedupeCandidates,
  postCode,
  postOwner,
  RawPost,
} from '../../../../lib/ingestion';
import { editorialRows } from '../../../../lib/editorial-feed';
import { parseTimestamp, toChileDateString } from '../../../../lib/event-extraction';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';
class IngestionError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}
const record = (v: unknown): RawPost =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as RawPost) : {};
const reply = (body: object, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization') || '';
  const expected = `Bearer ${secret}`;
  if (!secret) return reply({ error: 'Cron no disponible.' }, 503);
  if (
    Buffer.byteLength(auth) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(auth), Buffer.from(expected))
  )
    return reply({ error: 'Unauthorized' }, 401);
  const db = getAdminDb(),
    token = process.env.APIFY_API_TOKEN;
  const missing = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'APIFY_API_TOKEN'].filter(
    (k) => !process.env[k],
  );
  if (!db || !token) return reply({ error: 'Configuración incompleta.', missing }, 503);
  const actor = process.env.APIFY_ACTOR || 'apify~instagram-scraper';
  if (!/^[\w~-]+$/.test(actor)) return reply({ error: 'APIFY_ACTOR inválido.' }, 503);
  const limit = boundedResultsLimit(process.env.APIFY_RESULTS_LIMIT);
  const { data: runId, error: claimError } = await db.rpc('claim_ingestion_run');
  if (claimError) return reply({ error: 'No se pudo reservar la ingesta.' }, 503);
  if (!runId)
    return reply({
      success: true,
      skipped: 'cooldown',
      message: 'Ya hubo una ingesta en las últimas 6 horas.',
    });
  const started = Date.now();
  let apifyId: string | null = null;
  let datasetId: string | null = null;
  let providerCompleted = false;
  const metrics: Record<string, unknown> = {
    accounts_scanned: ACTIVE_SOURCES.length,
    posts_found: 0,
    event_candidates: 0,
    events_saved: 0,
    public_events_added: 0,
    duplicates_suppressed: 0,
    source_rejected: 0,
    parse_failed: 0,
    expired: 0,
    classification_rejected: 0,
    campaign_suppressed: 0,
    location_ambiguous: 0,
    stale_post: 0,
    malformed: 0,
    already_processed: 0,
    results_limit_per_account: limit,
  };
  async function apify(path: string, init?: RequestInit): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(`https://api.apify.com/v2/${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      throw new IngestionError('APIFY_NETWORK');
    }
    if (!response.ok) throw new IngestionError(`APIFY_HTTP_${response.status}`);
    return response.json();
  }
  try {
    // Expiry is also enforced on every public read and by RLS; cleanup does not reactivate anything.
    const expire = await db
      .from('events')
      .update({ is_active: false })
      .eq('is_active', true)
      .lt('date_text', toChileDateString(new Date()));
    if (expire.error) throw new IngestionError('DB_EXPIRE');
    const editorial = editorialRows();
    metrics.editorial_reviewed = editorial.length;
    metrics.editorial_inserted = 0;
    if (editorial.length) {
      const imported = await db
        .from('events')
        .upsert(
          editorial.map((r) => ({ ...r, ingestion_run_id: runId })),
          { onConflict: 'instagram_id', ignoreDuplicates: true },
        )
        .select('instagram_id');
      if (imported.error) throw new IngestionError('DB_EDITORIAL');
      metrics.editorial_inserted = imported.data?.length || 0;
      metrics.public_events_added = metrics.editorial_inserted;
    }
    const start = record(
      await apify(`acts/${actor}/runs?timeout=180&maxItems=40&maxTotalChargeUsd=1`, {
        method: 'POST',
        body: JSON.stringify({
          directUrls: ACTIVE_SOURCES.map((h) => `https://www.instagram.com/${h}/`),
          resultsType: 'posts',
          resultsLimit: limit,
          onlyPostsNewerThan: '14 days',
          addParentData: false,
        }),
      }),
    );
    const run = record(start.data);
    apifyId = typeof run.id === 'string' ? run.id : null;
    datasetId = typeof run.defaultDatasetId === 'string' ? run.defaultDatasetId : null;
    if (!apifyId || !datasetId) throw new IngestionError('APIFY_INVALID_RUN');
    const savedRun = await db
      .from('ingestion_runs')
      .update({ apify_run_id: apifyId, dataset_id: datasetId })
      .eq('id', runId);
    if (savedRun.error) throw new IngestionError('DB_RUN');
    let finalRun: RawPost = run;
    while (Date.now() - started < 205000) {
      const status = String(finalRun.status || '');
      if (status === 'SUCCEEDED') {
        providerCompleted = true;
        break;
      }
      if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(status))
        throw new IngestionError(`APIFY_${status}`);
      await new Promise((resolve) => setTimeout(resolve, 3000));
      finalRun = record(record(await apify(`actor-runs/${apifyId}`)).data);
    }
    if (!providerCompleted) throw new IngestionError('APIFY_DEADLINE');
    const raw = await apify(`datasets/${datasetId}/items?format=json&clean=true&limit=100`);
    if (!Array.isArray(raw) || raw.length > 100) throw new IngestionError('APIFY_INVALID_DATASET');
    const items = raw.map(record);
    metrics.posts_found = items.length;
    const ids = items.map(postCode).filter((id): id is string => id !== null);
    const processed = ids.length
      ? await db.from('ingestion_posts').select('post_id').in('post_id', ids)
      : { data: [], error: null };
    if (processed.error) throw new IngestionError('DB_POSTS');
    const seen = new Set((processed.data || []).map((p) => p.post_id));
    const now = new Date();
    const candidates: NonNullable<ReturnType<typeof classifyPost>['row']>[] = [];
    const evidence: RawPost[] = [];
    const outcomes: { post_id: string | null; owner: string | null; reasons: string[] }[] = [];
    const sourceCounts: Record<string, number> = {};
    metrics.pipeline_version = 'r3';
    metrics.item_outcomes = outcomes;
    metrics.source_counts = sourceCounts;
    for (const item of items) {
      const code = postCode(item);
      const owner = postOwner(item);
      if (!owner) {
        metrics.source_rejected = Number(metrics.source_rejected) + 1;
        outcomes.push({
          post_id: code,
          owner:
            typeof item.ownerUsername === 'string' &&
            /^[a-zA-Z0-9_.]{1,40}$/.test(item.ownerUsername)
              ? item.ownerUsername
              : null,
          reasons: [item.error ? 'provider_error' : 'source_rejected'],
        });
        continue;
      }
      if (code && seen.has(code)) {
        metrics.already_processed = Number(metrics.already_processed) + 1;
      }
      sourceCounts[owner] = (sourceCounts[owner] || 0) + 1;
      const decisions = classifySourceItem(item, now);
      outcomes.push({ post_id: code, owner, reasons: decisions.map((d) => d.reason) });
      for (const decision of decisions) {
        if (decision.row) {
          candidates.push(decision.row);
          metrics.event_candidates = Number(metrics.event_candidates) + 1;
        } else metrics[decision.reason] = Number(metrics[decision.reason]) + 1;
      }
      if (code) {
        seen.add(code);
        evidence.push({
          post_id: code,
          source_account: owner,
          source_published_at:
            parseTimestamp(
              item.timestamp ?? item.takenAt ?? item.takenAtIso ?? item.publishedAt,
            )?.toISOString() || null,
          retrieved_at: now.toISOString(),
          caption: typeof item.caption === 'string' ? item.caption.slice(0, 10000) : '',
          source_url: `https://www.instagram.com/p/${code}/`,
          outcome: decisions.map((d) => d.reason).join(','),
          run_id: runId,
        });
      }
    }
    const { unique, duplicates } = dedupeCandidates(candidates);
    metrics.duplicates_suppressed = duplicates;
    const existing = unique.length
      ? await db
          .from('events')
          .select('instagram_id,event_key')
          .or(
            `instagram_id.in.(${unique.map((r) => r.instagram_id).join(',')}),event_key.in.(${unique.map((r) => `"${r.event_key}"`).join(',')})`,
          )
      : { data: [], error: null };
    if (existing.error) throw new IngestionError('DB_DEDUPE');
    const knownIds = new Set((existing.data || []).map((r) => r.instagram_id));
    const knownKeys = new Set((existing.data || []).map((r) => r.event_key));
    const fresh = unique.filter(
      (r) => !knownIds.has(r.instagram_id) && !knownKeys.has(r.event_key),
    );
    metrics.duplicates_suppressed =
      Number(metrics.duplicates_suppressed) + unique.length - fresh.length;
    if (fresh.length) {
      const saved = await db
        .from('events')
        .upsert(
          fresh.map((r) => ({ ...r, ingestion_run_id: runId })),
          { onConflict: 'instagram_id', ignoreDuplicates: true },
        )
        .select('instagram_id');
      if (saved.error) throw new IngestionError('DB_CANDIDATES');
      metrics.events_saved = saved.data?.length || 0;
    }
    if (evidence.length) {
      const saved = await db
        .from('ingestion_posts')
        .upsert(evidence, { onConflict: 'post_id', ignoreDuplicates: true });
      if (saved.error) throw new IngestionError('DB_EVIDENCE');
    }
    const cost = typeof finalRun.usageTotalUsd === 'number' ? finalRun.usageTotalUsd : null;
    metrics.duration_ms = Date.now() - started;
    metrics.apify_cost_usd = cost;
    const saved = await db
      .from('ingestion_runs')
      .update({
        status: 'succeeded',
        completed_at: new Date().toISOString(),
        metrics,
        cost_usd: cost,
      })
      .eq('id', runId);
    if (saved.error) throw new IngestionError('DB_FINISH');
    console.info('[ingestion]', JSON.stringify({ run_id: runId, ...metrics }));
    return reply({
      success: true,
      run_id: runId,
      ...metrics,
      timestamp: new Date().toISOString(),
      moderation: 'Instagram pending; editorial manifest already reviewed',
    });
  } catch (error) {
    const code = error instanceof IngestionError ? error.code : 'INGESTION_FAILED';
    if (apifyId && !providerCompleted)
      await apify(`actor-runs/${apifyId}/abort`, { method: 'POST' }).catch(() => undefined);
    metrics.duration_ms = Date.now() - started;
    await db
      .from('ingestion_runs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_code: code,
        metrics,
      })
      .eq('id', runId);
    console.error('[ingestion]', JSON.stringify({ run_id: runId, error_code: code }));
    return reply(
      {
        success: false,
        error: 'No se pudo completar la ingesta.',
        error_code: code,
        run_id: runId,
      },
      502,
    );
  }
}
