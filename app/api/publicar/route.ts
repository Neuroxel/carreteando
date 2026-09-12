import { NextResponse } from 'next/server';
import { saveEvent } from '../../../lib/events-store';
import { EventoFormData } from '../../../lib/types';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as EventoFormData;

    if (!body.nombre || !body.lugar || !body.fecha) {
      return NextResponse.json(
        { success: false, error: 'Faltan campos obligatorios (nombre, lugar, fecha)' },
        { status: 400 }
      );
    }

    const newEvent = saveEvent(body);

    return NextResponse.json({
      success: true,
      evento: newEvent,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Error al guardar el evento' },
      { status: 500 }
    );
  }
}
