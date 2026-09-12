import { Evento, EventoFormData, FiltrosEvento } from './types';
import { EVENTOS_INICIALES } from './data/mockEvents';
import { supabase } from './supabase';

const STORAGE_KEY = 'carretes_valpo_eventos_v1';
const RSVPS_KEY = 'carretes_valpo_rsvps_v1';

let memoryEvents: Evento[] = [...EVENTOS_INICIALES];

// Adaptador: Convierte fila de DB (events) a tipo Evento de la app
function dbRowToEvento(row: any): Evento {
  return {
    id: String(row.id || row.instagram_id),
    nombre: row.title || 'Evento sin nombre',
    descripcion: row.description || '',
    fecha: row.date_text || new Date(row.scraped_at || Date.now()).toISOString().split('T')[0],
    hora: '22:00',
    lugar: row.location || 'Valparaíso',
    ciudad: row.location || 'Valparaíso',
    sector: null,
    precio: 0,
    precio_texto: 'Ver detalles en post',
    categoria: 'under',
    imagen_url: row.image_url || 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1200&q=80',
    fuente: 'instagram',
    fuente_url: row.instagram_url || null,
    organizador: row.username ? (row.username.startsWith('@') ? row.username : `@${row.username}`) : '@valpocarretes',
    organizador_url: row.username ? `https://instagram.com/${row.username.replace('@', '')}` : null,
    verificado: false,
    destacado: false,
    activo: row.is_active !== false,
    asistentes_interesados: row.likes || 1,
    tags: ['carrete', 'instagram', row.location || 'valpo'],
    created_at: row.scraped_at || new Date().toISOString(),
  };
}

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

// Fetch asíncrono desde Supabase con fallback a localStorage/memoria
export async function fetchEventsFromSupabase(): Promise<Evento[]> {
  if (!supabase) {
    return getStoredEvents();
  }

  try {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('is_active', true)
      .order('scraped_at', { ascending: false });

    if (error || !data || data.length === 0) {
      return getStoredEvents();
    }

    const fetchedEvents = data.map(dbRowToEvento);
    
    // Unir con los locales/mock sin duplicar
    const existingIds = new Set(fetchedEvents.map((e) => e.id));
    const combined = [...fetchedEvents, ...EVENTOS_INICIALES.filter((m) => !existingIds.has(m.id))];

    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(combined));
      window.dispatchEvent(new Event('carretes_storage_updated'));
    }

    memoryEvents = combined;
    return combined;
  } catch (err) {
    console.error('Error fetching events from Supabase:', err);
    return getStoredEvents();
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

  // Si Supabase está disponible, guardar también en la nube
  if (supabase) {
    supabase.from('events').insert({
      instagram_id: newEvent.id,
      title: newEvent.nombre,
      description: newEvent.descripcion,
      date_text: newEvent.fecha,
      location: newEvent.ciudad,
      image_url: newEvent.imagen_url,
      instagram_url: newEvent.fuente_url,
      username: newEvent.organizador,
      likes: 1,
      source: 'manual',
      is_active: true,
    }).then(({ error }: any) => {
      if (error) console.error('Error saving to Supabase:', error);
    });
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
    if (!evt.activo) return false;

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

    if (filters.categoria && filters.categoria !== 'todos') {
      if (evt.categoria !== filters.categoria) return false;
    }

    if (filters.ciudad && filters.ciudad !== 'todos') {
      if (evt.ciudad.toLowerCase() !== filters.ciudad.toLowerCase()) return false;
    }

    if (filters.precio && filters.precio !== 'todos') {
      if (filters.precio === 'gratis' && evt.precio > 0) return false;
      if (filters.precio === 'pago' && evt.precio === 0) return false;
    }

    if (filters.fecha && filters.fecha !== 'todos') {
      const evtDate = evt.fecha;
      const today = new Date();
      const currentDayOfWeek = today.getDay();

      if (filters.fecha === 'hoy') {
        if (evtDate !== todayStr) return false;
      } else if (filters.fecha === 'finde') {
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
