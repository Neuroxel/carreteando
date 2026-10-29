import { NextResponse } from 'next/server';
import { getPublicEvents } from '../../../lib/server-events';
import { filterEvents } from '../../../lib/events';
import { parseFilters } from '../../../lib/filters';
import { ahoraEnChile, visibleEnCartelera } from '../../../lib/temporal';
import { fechaDeLaNoche } from '../../../lib/event-extraction';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const result = await getPublicEvents();
  if (result.status === 'error')
    return NextResponse.json(
      { success: false, error: 'La cartelera no está disponible temporalmente.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  const now = new Date(result.checkedAt);
  const ahora = ahoraEnChile(now);
  const eventos = filterEvents(result.events, parseFilters(new URL(request.url).searchParams), fechaDeLaNoche(now), ahora)
    .filter((evento) => visibleEnCartelera(evento, ahora));
  return NextResponse.json(
    { success: true, total: eventos.length, eventos, checked_at: result.checkedAt },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
