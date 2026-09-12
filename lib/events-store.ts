import { Evento, EventoFormData, FiltrosEvento } from './types';
import { EVENTOS_INICIALES } from './data/mockEvents';

const STORAGE_KEY = 'carretes_valpo_eventos_v1';
const RSVPS_KEY = 'carretes_valpo_rsvps_v1';

// Almacenamiento en memoria para el servidor
let memoryEvents: Evento[] = [...EVENTOS_INICIALES];

export function getStoredEvents(): Evento[] {
  if (typeof window === 'undefined') {
    return memoryEvents;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(EVENTOS_INICIALES));
      return EVENTOS_INICIALES;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : EVENTOS_INICIALES;
  } catch {
    return EVENTOS_INICIALES;
  }
}

export function saveEvent(formData: EventoFormData): Evento {
  const newEvent: Evento = {
    id: 'evt-user-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
    nombre: formData.nombre.trim(),
    descripcion: formData.descripcion.trim(),
    fecha: formData.fecha,
    hora: formData.hora || '22:00',
    lugar: formData.lugar.trim(),
    ciudad: formData.ciudad || 'Valparaíso',
    sector: formData.sector?.trim() || null,
    precio: typeof formData.precio === 'number' ? formData.precio : 0,
    precio_texto: formData.precio_texto?.trim() || (formData.precio === 0 ? 'Entrada Liberada' : `$${Number(formData.precio).toLocaleString('es-CL')}`),
    categoria: formData.categoria,
    imagen_url:
      formData.imagen_url?.trim() ||
      'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1200&q=80',
    fuente: 'manual',
    fuente_url: formData.fuente_url?.trim() || null,
    organizador: formData.organizador.trim().startsWith('@') ? formData.organizador.trim() : `@${formData.organizador.trim()}`,
    organizador_url: formData.organizador_url || (formData.organizador.startsWith('@') ? `https://instagram.com/${formData.organizador.replace('@', '')}` : null),
    verificado: false,
    destacado: false,
    activo: true,
    asistentes_interesados: 1,
    tags: formData.tags ? formData.tags.split(',').map((t) => t.trim().toLowerCase()) : ['carrete', formData.categoria],
    created_at: new Date().toISOString(),
  };

  memoryEvents.unshift(newEvent);

  if (typeof window !== 'undefined') {
    try {
      const current = getStoredEvents();
      const updated = [newEvent, ...current];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new Event('carretes_storage_updated'));
    } catch (err) {
      console.error('Error saving event to localStorage:', err);
    }
  }

  return newEvent;
}

export function getEventById(id: string): Evento | undefined {
  const events = getStoredEvents();
  return events.find((e) => e.id === id);
}

export function toggleRsvp(eventId: string): { interested: boolean; count: number } {
  if (typeof window === 'undefined') return { interested: false, count: 0 };

  try {
    const rawRsvps = localStorage.getItem(RSVPS_KEY);
    const rsvps: string[] = rawRsvps ? JSON.parse(rawRsvps) : [];
    const isAlready = rsvps.includes(eventId);

    const newRsvps = isAlready ? rsvps.filter((id) => id !== eventId) : [...rsvps, eventId];
    localStorage.setItem(RSVPS_KEY, JSON.stringify(newRsvps));

    // Actualizar conteo en eventos
    const events = getStoredEvents();
    const target = events.find((e) => e.id === eventId);
    let newCount = target?.asistentes_interesados || 0;

    if (target) {
      newCount = isAlready ? Math.max(0, newCount - 1) : newCount + 1;
      target.asistentes_interesados = newCount;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
      window.dispatchEvent(new Event('carretes_storage_updated'));
    }

    return { interested: !isAlready, count: newCount };
  } catch {
    return { interested: false, count: 0 };
  }
}

export function getUserRsvps(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RSVPS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function filterEvents(events: Evento[], filters: FiltrosEvento): Evento[] {
  const todayStr = new Date().toISOString().split('T')[0];

  return events.filter((evt) => {
    // 1. Activo
    if (!evt.activo) return false;

    // 2. Busqueda texto
    if (filters.busqueda && filters.busqueda.trim() !== '') {
      const q = filters.busqueda.toLowerCase().trim();
      const matchName = evt.nombre.toLowerCase().includes(q);
      const matchDesc = evt.descripcion?.toLowerCase().includes(q);
      const matchLugar = evt.lugar?.toLowerCase().includes(q);
      const matchOrg = evt.organizador?.toLowerCase().includes(q);
      const matchCity = evt.ciudad.toLowerCase().includes(q);
      const matchTags = evt.tags?.some((t) => t.toLowerCase().includes(q));

      if (!matchName && !matchDesc && !matchLugar && !matchOrg && !matchCity && !matchTags) {
        return false;
      }
    }

    // 3. Categoria
    if (filters.categoria && filters.categoria !== 'todos') {
      if (evt.categoria !== filters.categoria) return false;
    }

    // 4. Ciudad
    if (filters.ciudad && filters.ciudad !== 'todos') {
      if (evt.ciudad.toLowerCase() !== filters.ciudad.toLowerCase()) return false;
    }

    // 5. Precio
    if (filters.precio && filters.precio !== 'todos') {
      if (filters.precio === 'gratis' && evt.precio > 0) return false;
      if (filters.precio === 'pago' && evt.precio === 0) return false;
    }

    // 6. Fecha
    if (filters.fecha && filters.fecha !== 'todos') {
      const evtDate = evt.fecha;
      const today = new Date();
      const currentDayOfWeek = today.getDay(); // 0 Dom, 1 Lun, ..., 6 Sab

      if (filters.fecha === 'hoy') {
        if (evtDate !== todayStr) return false;
      } else if (filters.fecha === 'finde') {
        // Fin de semana más próximo (Viernes, Sábado, Domingo)
        const diffToFri = (5 - currentDayOfWeek + 7) % 7;
        const fri = new Date(today);
        fri.setDate(today.getDate() + diffToFri);

        const sun = new Date(fri);
        sun.setDate(fri.getDate() + 2);

        const friStr = fri.toISOString().split('T')[0];
        const sunStr = sun.toISOString().split('T')[0];

        if (evtDate < todayStr || evtDate > sunStr) return false;
      } else if (filters.fecha === 'semana') {
        const nextWeek = new Date(today);
        nextWeek.setDate(today.getDate() + 7);
        const nextWeekStr = nextWeek.toISOString().split('T')[0];

        if (evtDate < todayStr || evtDate > nextWeekStr) return false;
      }
    }

    return true;
  });
}
