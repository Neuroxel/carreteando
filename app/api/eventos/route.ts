import { NextResponse } from 'next/server';
import { getPublicEvents } from '../../../lib/server-events';
import { filterEvents } from '../../../lib/events';
import { parseFilters } from '../../../lib/filters';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const result = await getPublicEvents();
  if (result.status === 'error')
    return NextResponse.json(
      { success: false, error: 'La cartelera no está disponible temporalmente.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  const eventos = filterEvents(result.events, parseFilters(new URL(request.url).searchParams));
  return NextResponse.json(
    { success: true, total: eventos.length, eventos, checked_at: result.checkedAt },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
