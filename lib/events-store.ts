import { Evento, EventoFormData, FiltrosEvento, Categoria } from './types';
import { supabase } from './supabase';

const RSVPS_KEY = 'carretes_valpo_rsvps_v1';

// Detector inteligente de joyitas y categorías para la araña
function detectCategoryAndJoyita(title: string, desc: string, username: string, source: string) {
  const text = `${title} ${desc} ${username} ${source}`.toLowerCase();

  const isJoyita =
    source === 'joyita_under' ||
    text.includes('spot secreto') ||
    text.includes('ubicación por dm') ||
    text.includes('por interno') ||
    text.includes('aporte voluntario') ||
    text.includes('al sobre') ||
    text.includes('galpón') ||
    text.includes('casona') ||
    text.includes('fonda dark') ||
    text.includes('post punk') ||
    text.includes('darkwave') ||
    text.includes('ebm') ||
    text.includes('industrial') ||
    text.includes('hard techno') ||
    text.includes('clandestin') ||
    text.includes('warhola') ||
    text.includes('insomnia') ||
    text.includes('cine foro') ||
    text.includes('autónom') ||
    text.includes('autogest') ||
    text.includes('tributo') ||
    text.includes('parque cultural');

  let categoria: Categoria = 'under';
  if (
    text.includes('techno') ||
    text.includes('rave') ||
    text.includes('house') ||
    text.includes('electronic') ||
    text.includes('djs') ||
    text.includes('live set') ||
    text.includes('acid')
  ) {
    categoria = 'electronica';
  } else if (
    text.includes('rock') ||
    text.includes('punk') ||
    text.includes('post-punk') ||
    text.includes('post punk') ||
    text.includes('metal') ||
    text.includes('tocata') ||
    text.includes('tributo') ||
    text.includes('banda') ||
    text.includes('en vivo')
  ) {
    categoria = 'rock';
  } else if (text.includes('cumbia') || text.includes('salsa') || text.includes('cueca') || text.includes('pachanga')) {
    categoria = 'cumbia';
  } else if (text.includes('reggaeton') || text.includes('perreo') || text.includes('bellakeo') || text.includes('urbano')) {
    categoria = 'reggaeton';
  } else if (text.includes('universitari') || text.includes('mechoneo') || text.includes('pucv') || text.includes('uv') || text.includes('usm') || text.includes('upla')) {
    categoria = 'universitario';
  } else if (isJoyita || text.includes('under') || text.includes('queer') || text.includes('drag')) {
    categoria = 'under';
  }

  const tags: string[] = ['instagram'];
  if (isJoyita) tags.push('💎 joyita oculta');
  if (categoria === 'electronica') tags.push('techno / rave');
  if (categoria === 'rock') tags.push('tocata viva');
  if (text.includes('gratis') || text.includes('liberada') || text.includes('al sobre')) tags.push('aporte voluntario');

  return { categoria, isJoyita, tags };
}

// Adaptador: Convierte fila de DB (events) a tipo Evento de la app
function dbRowToEvento(row: any): Evento {
  const { categoria, isJoyita, tags } = detectCategoryAndJoyita(
    row.title || '',
    row.description || '',
    row.username || '',
    row.source || ''
  );

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
    precio_texto: isJoyita ? 'Aporte Voluntario / Info por DM' : 'Ver detalles en Instagram',
    categoria,
    imagen_url: row.image_url || null,
    fuente: 'instagram',
    fuente_url: row.instagram_url || null,
    organizador: row.username ? (row.username.startsWith('@') ? row.username : `@${row.username}`) : null,
    organizador_url: row.username ? `https://www.instagram.com/${row.username.replace('@', '')}/` : null,
    verificado: false,
    destacado: isJoyita || (row.likes && row.likes > 400),
    activo: row.is_active !== false,
    asistentes_interesados: row.likes || 1,
    tags,
    created_at: row.scraped_at || new Date().toISOString(),
  };
}

export function getChileTodayStr(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date());
  } catch {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}

const STORAGE_KEY = 'carretes_valpo_eventos_v2_clean';
let memoryEvents: Evento[] = [];

export function getStoredEvents(): Evento[] {
  if (typeof window === 'undefined') {
    return memoryEvents;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const clean = parsed.filter((e) => e && e.fecha && e.fecha >= '2026-09-01');
        memoryEvents = clean;
        return clean;
      }
    }
  } catch {}
  return memoryEvents;
}

export function getEventById(id: string): Evento | undefined {
  return getStoredEvents().find((e) => e.id === id || e.fuente_url?.includes(id));
}

// Fetch desde Supabase — si no hay datos o falla, retorna []
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

    if (error) {
      console.error('Error fetching from Supabase:', error.message);
      return getStoredEvents();
    }

    if (!data || data.length === 0) {
      return getStoredEvents();
    }

    const mapped = data.map(dbRowToEvento);
    memoryEvents = mapped;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(mapped));
        window.dispatchEvent(new Event('carretes_storage_updated'));
      } catch {}
    }
    return mapped;
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
    imagen_url: formData.imagen_url?.trim() || null,
    fuente: 'manual',
    fuente_url: formData.fuente_url?.trim() || null,
    organizador: formData.organizador.trim().startsWith('@') ? formData.organizador.trim() : `@${formData.organizador.trim()}`,
    organizador_url: formData.organizador_url || (formData.organizador.startsWith('@') ? `https://www.instagram.com/${formData.organizador.replace('@', '')}/` : null),
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify([newEvent, ...current]));
      window.dispatchEvent(new Event('carretes_storage_updated'));
    } catch {}
  }

  // Guardar en Supabase si está disponible
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

export function toggleRsvp(eventId: string): { interested: boolean; count: number } {
  if (typeof window === 'undefined') return { interested: false, count: 0 };

  try {
    const rawRsvps = localStorage.getItem(RSVPS_KEY);
    const rsvps: string[] = rawRsvps ? JSON.parse(rawRsvps) : [];
    const isAlready = rsvps.includes(eventId);

    const newRsvps = isAlready ? rsvps.filter((id) => id !== eventId) : [...rsvps, eventId];
    localStorage.setItem(RSVPS_KEY, JSON.stringify(newRsvps));

    return { interested: !isAlready, count: 0 };
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
  const todayStr = getChileTodayStr();

  const filtered = events.filter((evt) => {
    if (!evt.activo) return false;

    // Descartar automáticamente contenido anterior a septiembre 2026 (elimina 2019, 2020, etc.)
    if (!evt.fecha || evt.fecha < '2026-09-01') return false;

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
      const currentDayOfWeek = today.getDay(); // 0=domingo, 5=viernes, 6=sábado

      if (filters.fecha === 'hoy') {
        if (evtDate !== todayStr) return false;
      } else if (filters.fecha === 'futuro') {
        // Todos los eventos desde hoy en adelante (hoy, mañana, fiestas patrias 18-19-20)
        if (evtDate < todayStr) return false;
      } else if (filters.fecha === 'finde') {
        // Fin de semana actual (Viernes a Domingo)
        const fri = new Date(today);
        const daysFromFri = (currentDayOfWeek === 0 ? 2 : currentDayOfWeek - 5);
        fri.setDate(today.getDate() - daysFromFri);

        const sun = new Date(fri);
        sun.setDate(fri.getDate() + 2);

        const friStr = fri.toISOString().split('T')[0];
        const sunStr = sun.toISOString().split('T')[0];

        if (evtDate < friStr || evtDate > sunStr) return false;
      } else if (filters.fecha === 'semana') {
        const nextWeek = new Date(today);
        nextWeek.setDate(today.getDate() + 7);
        const nextWeekStr = nextWeek.toISOString().split('T')[0];

        if (evtDate < todayStr || evtDate > nextWeekStr) return false;
      }
    }

    return true;
  });

  // Ordenar inteligentemente: Hoy y Futuro van PRIMERO (cronológico), eventos pasados al final
  return filtered.sort((a, b) => {
    const aIsFuture = (a.fecha || '') >= todayStr;
    const bIsFuture = (b.fecha || '') >= todayStr;

    if (aIsFuture && !bIsFuture) return -1;
    if (!aIsFuture && bIsFuture) return 1;

    if (aIsFuture && bIsFuture) {
      // Orden cronológico ascendente (los de hoy primero, luego mañana, luego el 18)
      return (a.fecha || '').localeCompare(b.fecha || '');
    }

    // Pasados: más recientes primero
    return (b.fecha || '').localeCompare(a.fecha || '');
  });
}
