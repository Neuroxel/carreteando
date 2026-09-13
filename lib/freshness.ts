export type Freshness = 'fresh' | 'updating' | 'delayed' | 'unknown';
export function sourceFreshness(
  run: { status: string; started_at: string; completed_at: string | null } | null,
  now = Date.now(),
): Freshness {
  if (!run) return 'unknown';
  const started = Date.parse(run.started_at);
  if (!Number.isFinite(started) || started > now + 300000) return 'unknown';
  if (run.status === 'running') return now - started < 600000 ? 'updating' : 'delayed';
  if (run.status !== 'succeeded' || !run.completed_at) return 'delayed';
  const completed = Date.parse(run.completed_at);
  if (!Number.isFinite(completed) || completed > now + 300000) return 'unknown';
  return now - completed <= 36 * 3600000 ? 'fresh' : 'delayed';
}
