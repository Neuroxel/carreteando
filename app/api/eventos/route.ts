import { NextResponse } from 'next/server';
import { getStoredEvents, filterEvents } from '../../../lib/events-store';
import { Categoria } from '../../../lib/types';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const busqueda = searchParams.get('q') || undefined;
  const categoria = (searchParams.get('categoria') as Categoria) || 'todos';
  const ciudad = searchParams.get('ciudad') || 'todos';
  const fecha = (searchParams.get('fecha') as 'todos' | 'hoy' | 'finde' | 'semana') || 'todos';
  const precio = (searchParams.get('precio') as 'todos' | 'gratis' | 'pago') || 'todos';

  const allEvents = getStoredEvents();
  const filtered = filterEvents(allEvents, {
    busqueda,
    categoria,
    ciudad,
    fecha,
    precio,
  });

  return NextResponse.json({
    success: true,
    total: filtered.length,
    eventos: filtered,
  });
}
