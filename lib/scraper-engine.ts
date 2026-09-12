import { Evento, Categoria } from './types';

export interface MonitoredAccount {
  handle: string;
  nombre: string;
  tipo: 'club' | 'universidad' | 'colectivo' | 'productora';
  ciudad: string;
  seguidores: string;
  avatar: string;
  ultimoEventoDetectado?: string;
}

export const MONITORED_IG_ACCOUNTS: MonitoredAccount[] = [
  {
    handle: '@el.huevo',
    nombre: 'El Huevo Valparaíso',
    tipo: 'club',
    ciudad: 'Valparaíso',
    seguidores: '22K',
    avatar: 'https://images.unsplash.com/photo-1541532713592-79a0317b6b77?auto=format&fit=crop&w=150&q=80',
    ultimoEventoDetectado: 'Viernes Universitario 3 Pisos',
  },
  {
    handle: '@trotamundosvalpo',
    nombre: 'Trotamundos Valparaíso',
    tipo: 'club',
    ciudad: 'Valparaíso',
    seguidores: '71K',
    avatar: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=150&q=80',
    ultimoEventoDetectado: 'Ciclo en Vivo & Fiesta Post-Show',
  },
  {
    handle: '@clubtrotaquilpue',
    nombre: 'Trotamundos Terraza Quilpué',
    tipo: 'club',
    ciudad: 'Quilpué',
    seguidores: '85K',
    avatar: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=150&q=80',
    ultimoEventoDetectado: 'Tocatas en Vivo & Fiesta en Terraza',
  },
  {
    handle: '@club_segundo_piso',
    nombre: 'Club Segundo Piso',
    tipo: 'club',
    ciudad: 'Valparaíso',
    seguidores: '30K',
    avatar: 'https://images.unsplash.com/photo-1545128485-c400e7702796?auto=format&fit=crop&w=150&q=80',
    ultimoEventoDetectado: 'Ciclo Electrónico & Under',
  },
  {
    handle: '@mascara_valparaiso',
    nombre: 'Máscara Club Valparaíso',
    tipo: 'club',
    ciudad: 'Valparaíso',
    seguidores: '28K',
    avatar: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=150&q=80',
    ultimoEventoDetectado: 'Fiesta Indie & Post-Punk',
  },
  {
    handle: '@paganocl',
    nombre: 'Pagano Club Lounge',
    tipo: 'club',
    ciudad: 'Valparaíso',
    seguidores: '32K',
    avatar: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=150&q=80',
    ultimoEventoDetectado: 'Fiesta Drag, Pop & Ultrabailable',
  },
  {
    handle: '@terraza_bellavista_valpo',
    nombre: 'Terraza Bellavista',
    tipo: 'club',
    ciudad: 'Valparaíso',
    seguidores: '42K',
    avatar: 'https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?auto=format&fit=crop&w=150&q=80',
    ultimoEventoDetectado: 'Reggaeton & Noche Urbana Porteña',
  },
];

export interface ParsedEventCandidate {
  nombre: string;
  descripcion: string;
  fecha: string;
  hora: string;
  lugar: string;
  ciudad: string;
  precio: number;
  precio_texto: string;
  categoria: Categoria;
  organizador: string;
  fuente_url: string;
  imagen_url: string;
  tags: string[];
}

// Analizador heurístico inteligente de captions de Instagram (LLM Fallback & Parser)
export function parseInstagramCaption(
  caption: string,
  handle: string,
  postUrl: string,
  imageUrl?: string
): ParsedEventCandidate {
  const lower = caption.toLowerCase();

  // 1. Detectar categoría
  let categoria: Categoria = 'otro';
  if (lower.includes('mechoneo') || lower.includes('universit') || lower.includes('facultad') || lower.includes('usm') || lower.includes('pucv') || lower.includes('upla') || lower.includes('uv')) {
    categoria = 'universitario';
  } else if (lower.includes('techno') || lower.includes('house') || lower.includes('rave') || lower.includes('electronic') || lower.includes('dj set')) {
    categoria = 'electronica';
  } else if (lower.includes('cumbia') || lower.includes('pachanga') || lower.includes('salsa') || lower.includes('terremoto') || lower.includes('tropical')) {
    categoria = 'cumbia';
  } else if (lower.includes('perreo') || lower.includes('reggaeton') || lower.includes('bellakeo') || lower.includes('y2k') || lower.includes('flow')) {
    categoria = 'reggaeton';
  } else if (lower.includes('rock') || lower.includes('punk') || lower.includes('banda') || lower.includes('tocata') || lower.includes('indie')) {
    categoria = 'rock';
  } else if (lower.includes('under') || lower.includes('secreto') || lower.includes('bodega') || lower.includes('galpon') || lower.includes('industrial')) {
    categoria = 'under';
  }

  // 2. Extraer precio
  let precio = 0;
  let precio_texto = 'Entrada Liberada';
  const priceMatch = caption.match(/(\$|clp)\s?([0-9]{1,2}\.?[0-9]{3})/i);
  if (priceMatch) {
    const rawNumber = priceMatch[2].replace('.', '');
    precio = parseInt(rawNumber, 10);
    precio_texto = `$${precio.toLocaleString('es-CL')} en puerta/preventa`;
  } else if (lower.includes('gratis') || lower.includes('liberada') || lower.includes('free')) {
    precio = 0;
    precio_texto = 'Entrada Liberada / Lista Free';
  }

  // 3. Extraer fecha tentativa (ej: viernes, sabado, hoy, manana, 15 de marzo, etc.)
  const today = new Date();
  let targetDate = new Date();
  if (lower.includes('hoy') || lower.includes('esta noche')) {
    // hoy
  } else if (lower.includes('mañana')) {
    targetDate.setDate(targetDate.getDate() + 1);
  } else if (lower.includes('viernes')) {
    const diff = (5 - today.getDay() + 7) % 7 || 7;
    targetDate.setDate(today.getDate() + diff);
  } else if (lower.includes('sabado') || lower.includes('sábado')) {
    const diff = (6 - today.getDay() + 7) % 7 || 7;
    targetDate.setDate(today.getDate() + diff);
  } else {
    // Default a próximo viernes/sábado
    const diff = (5 - today.getDay() + 7) % 7;
    targetDate.setDate(today.getDate() + diff);
  }
  const fechaStr = targetDate.toISOString().split('T')[0];

  // 4. Extraer hora
  let hora = '22:00';
  const hourMatch = caption.match(/([0-2]?[0-9])[:.]([0-5][0-9])\s?(hrs|hr|pm|am)?/i);
  if (hourMatch) {
    hora = `${hourMatch[1].padStart(2, '0')}:${hourMatch[2]}`;
  }

  // 5. Extraer lugar
  let lugar = 'Valparaíso Centro';
  let ciudad = 'Valparaíso';

  if (lower.includes('el huevo')) lugar = 'El Huevo (Blanco #1386)';
  else if (lower.includes('terraza bellavista')) lugar = 'Terraza Bellavista (Blanco #1255)';
  else if (lower.includes('mascara') || lower.includes('máscara')) lugar = 'Mascara Club (Plaza Aníbal Pinto)';
  else if (lower.includes('trotamundos')) {
    lugar = 'Trotamundos Terraza (Aníbal Pinto #851, Quilpué)';
    ciudad = 'Quilpué';
  } else if (lower.includes('muelle barón') || lower.includes('muelle baron')) lugar = 'Galpón Muelle Barón';
  else if (lower.includes('subida ecuador') || lower.includes('ecuador')) lugar = 'Subida Ecuador, Valparaíso';
  else if (lower.includes('reñaca') || lower.includes('renaca')) {
    lugar = 'Sector 5, Reñaca';
    ciudad = 'Reñaca';
  } else if (lower.includes('viña') || lower.includes('vina')) {
    lugar = '1 Norte con San Martín';
    ciudad = 'Viña del Mar';
  }

  // 6. Nombre sugerido
  const lines = caption.split('\n').filter((l) => l.trim().length > 3);
  const rawTitle = lines[0] ? lines[0].replace(/[#@*🔥🎉🍻✨]/g, '').trim() : `Carrete Porteño en ${lugar}`;
  const nombre = rawTitle.length > 80 ? rawTitle.substring(0, 80) + '...' : rawTitle;

  return {
    nombre: nombre || `Carrete con ${handle}`,
    descripcion: caption.trim(),
    fecha: fechaStr,
    hora,
    lugar,
    ciudad,
    precio,
    precio_texto,
    categoria,
    organizador: handle,
    fuente_url: postUrl,
    imagen_url:
      imageUrl ||
      'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80',
    tags: [categoria, ciudad.toLowerCase(), 'instagram', 'radar'],
  };
}
