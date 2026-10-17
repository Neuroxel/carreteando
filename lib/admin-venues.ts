/**
 * Cola de lugares del panel. La fuente de verdad es `disposition` (la fija el
 * trigger `set_venue_disposition`), no `moderation_status`: un lugar cerrado
 * puede conservar `moderation_status = 'pending'` de antes de cerrarse, y no
 * por eso necesita a una persona.
 */
type Lugar = { disposition?: unknown };

export function agruparLugares<T extends Lugar>(lugares: T[]) {
  const porRevisar: T[] = [];
  const publicados: T[] = [];
  const archivados: T[] = [];
  for (const l of lugares) {
    if (l.disposition === 'needs_evidence') porRevisar.push(l);
    else if (l.disposition === 'published') publicados.push(l);
    else archivados.push(l); // closed, rejected, duplicate
  }
  return { porRevisar, publicados, archivados };
}
