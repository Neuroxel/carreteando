// Community reports are opinions from people who are there, never measurements.
export const LIVE_KINDS = {
  ambiente: {
    label: '¿Cómo está el ambiente?',
    ttlMin: 90,
    values: [
      { value: 'tranquilo', label: 'Tranquilo' },
      { value: 'medio', label: 'Medio' },
      { value: 'prendido', label: 'Prendido' },
    ],
  },
  espacio: {
    label: '¿Cuánta gente hay?',
    ttlMin: 90,
    values: [
      { value: 'vacio', label: 'Vacío' },
      { value: 'normal', label: 'Normal' },
      { value: 'lleno', label: 'Lleno' },
    ],
  },
  fila: {
    label: '¿Hay fila?',
    ttlMin: 45,
    values: [
      { value: 'sin-fila', label: 'Sin fila' },
      { value: 'poca', label: 'Poca' },
      { value: 'larga', label: 'Larga' },
    ],
  },
  estado: {
    label: '¿Está abierto?',
    ttlMin: 120,
    values: [
      { value: 'abierto', label: 'Abierto' },
      { value: 'cerrado', label: 'Cerrado' },
      { value: 'termino', label: 'Ya terminó' },
    ],
  },
} as const;
export type LiveKind = keyof typeof LIVE_KINDS;
export const LIVE_KIND_LIST = Object.keys(LIVE_KINDS) as LiveKind[];
export function validLiveReport(kind: string, value: string): kind is LiveKind {
  const k = LIVE_KINDS[kind as LiveKind];
  return !!k && k.values.some((v) => v.value === value);
}
export type LiveRow = { kind: string; value: string; created_at: string };
export type LiveSummary = {
  kind: LiveKind;
  label: string;
  value: string;
  valueLabel: string;
  count: number;
  total: number;
  minutes: number;
};
// Two agreeing voices is the floor. One person's opinion is not a status.
export const MIN_REPORTS = 2;
export function summarizeLive(rows: LiveRow[], now = Date.now()): LiveSummary[] {
  const out: LiveSummary[] = [];
  for (const kind of LIVE_KIND_LIST) {
    const mine = rows.filter((r) => r.kind === kind);
    if (mine.length < MIN_REPORTS) continue;
    const tally = new Map<string, number>();
    for (const r of mine) tally.set(r.value, (tally.get(r.value) || 0) + 1);
    const [value, count] = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
    const newest = Math.max(...mine.map((r) => Date.parse(r.created_at)).filter(Number.isFinite));
    if (!Number.isFinite(newest)) continue;
    out.push({
      kind,
      label: LIVE_KINDS[kind].label,
      value,
      valueLabel: LIVE_KINDS[kind].values.find((v) => v.value === value)?.label || value,
      count,
      total: mine.length,
      minutes: Math.max(0, Math.round((now - newest) / 60000)),
    });
  }
  return out;
}
