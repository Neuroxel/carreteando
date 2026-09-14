import { extractEventDate, normalizeText } from './event-extraction';
// Only independently dated lines. Prose/carousels and inherited prices stay for review.
export function splitDatedAgenda(caption: string, publishedAt: string): string[] {
  const lines = caption
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const dated = lines.filter((l) =>
    /^(?:[•*-]\s*)?(?:(?:lunes|martes|miercoles|jueves|viernes|sabado|domingo)\s+)?\d{1,2}(?:[/-]\d{1,2}|(?:\s+de)?\s+(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre))\b/.test(
      normalizeText(l),
    ),
  );
  if (dated.length < 2 || dated.length > 6) return [];
  // All dated segments must parse; never salvage only the convenient rows.
  if (dated.some((l) => !extractEventDate(l, publishedAt))) return [];
  return dated;
}
