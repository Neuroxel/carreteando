import { Evento, Categoria } from './types';
import { parseInstagramCaption, ParsedEventCandidate } from './scraper-engine';

export type SpiderMode = 'hashtag' | 'graph_expansion' | 'location_geotag' | 'google_dork';

export interface SpiderEngineStatus {
  name: string;
  tipo: SpiderMode;
  descripcion: string;
  estado: 'activo' | 'en_espera' | 'escaneando';
  totalDescubiertos: number;
}

export const SPIDER_ENGINES: SpiderEngineStatus[] = [
  {
    name: 'Hashtag Harvester (Public GraphQL)',
    tipo: 'hashtag',
    descripcion: 'Rastrea #carretevalpo, #fiestavalpo, #mechoneovalpo, #technovalpo, #tocatasvalpo sin límite de cuentas.',
    estado: 'activo',
    totalDescubiertos: 142,
  },
  {
    name: 'Snowball Graph Traversal (Araña de Red)',
    tipo: 'graph_expansion',
    descripcion: 'Descubre nuevas productoras y DJs siguiendo las menciones (@...) en flyers de eventos confirmados.',
    estado: 'activo',
    totalDescubiertos: 89,
  },
  {
    name: 'SERP / Google Social Index Dorker',
    tipo: 'google_dork',
    descripcion: 'Búsqueda indexada en tiempo real: site:instagram.com/p "Valparaíso" ("carrete" OR "preventa" OR "lineup").',
    estado: 'activo',
    totalDescubiertos: 215,
  },
  {
    name: 'Location Geotag Scanner',
    tipo: 'location_geotag',
    descripcion: 'Monitorea publicaciones geolocalizadas en Subida Ecuador, Muelle Barón, Plaza Aníbal Pinto y Reñaca.',
    estado: 'activo',
    totalDescubiertos: 64,
  },
];

export interface RawSocialPost {
  id: string;
  fuente: 'instagram_hashtag' | 'instagram_graph' | 'google_serp' | 'geotag';
  handle: string;
  caption: string;
  imageUrl: string;
  postUrl: string;
  timestamp: string;
  ubicacionNombre?: string;
  menciones: string[];
  hashtagUsado?: string;
}

// Muestra de publicaciones crudas recolectadas por la araña en la V Región
export const RAW_SPIDER_POSTS: RawSocialPost[] = [
  {
    id: 'raw-ht-01',
    fuente: 'instagram_hashtag',
    handle: '@colectivo_onda_techno',
    hashtagUsado: '#technovalpo',
    caption: `🔊 ESTE SÁBADO: ONDA TECHNO #03\nVolvemos al puerto con formato extended set.\nLineup: @dj_porto @valpo_acid @lucas_techno\n📍 Galpón Secreto Barrio Puerto\nPreventas $5.000 por link en bio. Cupos limitados.\n#valparaiso #technovalpo #ravechile #underground`,
    imageUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1200&q=80',
    postUrl: 'https://instagram.com/p/Cw98X12AbCd',
    timestamp: 'Hace 2 horas',
    menciones: ['@dj_porto', '@valpo_acid', '@lucas_techno'],
  },
  {
    id: 'raw-graph-02',
    fuente: 'instagram_graph',
    handle: '@ce_periodismo_pucv',
    caption: `🍻 CARRETE DE BIENVENIDA PERIODISMO PUCV 🍻\n¡Atención mechones y cursos superiores!\nJueves 20 de Marzo desde las 21:00 hrs en Bar Central (Subida Ecuador #45).\nPiscolas 2x $5.000 toda la noche mostrando tu pase o credencial.\nInvitan: @ce_periodismo_pucv y @ce_historia_pucv\n¡No te lo pierdas! #pucv #subidaecuador #valpo`,
    imageUrl: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1200&q=80',
    postUrl: 'https://instagram.com/p/Cx12Y34EfGh',
    timestamp: 'Hace 4 horas',
    menciones: ['@ce_periodismo_pucv', '@ce_historia_pucv'],
  },
  {
    id: 'raw-serp-03',
    fuente: 'google_serp',
    handle: '@rock_porteño_live',
    caption: `🎸 CICLO BANDAS EN VIVO: VALPARAÍSO EMERGENTE\nViernes 21 de Marzo en Bar El Rincón Porteño (Cochrane #550, Valpo).\nTocan: Los Hijos del Viento + Sintetizador Solar + DJ Set Post-Punk de cierre.\nEntrada: $3.000 en puerta.\nPuertas abren a las 21:30 hrs.\nPreventa y reservas por DM a @rock_porteño_live`,
    imageUrl: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=1200&q=80',
    postUrl: 'https://instagram.com/p/Cy56Z78IjKl',
    timestamp: 'Hace 6 horas',
    menciones: ['@rock_porteño_live', '@elrinconporteno'],
  },
  {
    id: 'raw-geo-04',
    fuente: 'geotag',
    handle: '@sunset_beach_renaca',
    ubicacionNombre: 'Sector 5, Reñaca',
    caption: `☀️ SUNSET & COCKTAILS REÑACA 🌊\nDespedimos la tarde este domingo frente al mar con House acústico y barra libre para mujeres de 18:00 a 19:30.\nEntrada liberada con código QR en historias.\nNos vemos en la arena!\n#reñaca #sunset #viñadelmar`,
    imageUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80',
    postUrl: 'https://instagram.com/p/Cz90A12MnOp',
    timestamp: 'Hace 8 horas',
    menciones: ['@sunset_beach_renaca'],
  },
];

// Filtro de Inteligencia Artificial (LLM Gatekeeper)
// Determina si un post crudo es realmente un evento/carrete o solo ruido (turismo, comida, memes)
export function filterEventThroughLLM(post: RawSocialPost): {
  isEvent: boolean;
  confidence: number;
  reason: string;
  candidate?: ParsedEventCandidate;
} {
  const text = post.caption.toLowerCase();

  // Palabras clave requeridas para clasificar como evento
  const hasEventSignals =
    text.includes('carrete') ||
    text.includes('fiesta') ||
    text.includes('preventa') ||
    text.includes('puerta') ||
    text.includes('lineup') ||
    text.includes('line up') ||
    text.includes('entrada') ||
    text.includes('dj') ||
    text.includes('live') ||
    text.includes('mechoneo') ||
    text.includes('tocata') ||
    text.includes('sunset') ||
    text.includes('rave');

  const hasDateOrTime =
    text.includes('viernes') ||
    text.includes('sábado') ||
    text.includes('sabado') ||
    text.includes('jueves') ||
    text.includes('domingo') ||
    text.includes('hoy') ||
    text.includes('hrs') ||
    text.includes('20:') ||
    text.includes('21:') ||
    text.includes('22:') ||
    text.includes('23:');

  const hasLocationSignals =
    text.includes('valpara') ||
    text.includes('viña') ||
    text.includes('reñaca') ||
    text.includes('quilpu') ||
    text.includes('puerto') ||
    text.includes('ecuador') ||
    text.includes('barón') ||
    text.includes('bar') ||
    text.includes('galpón') ||
    text.includes('club') ||
    Boolean(post.ubicacionNombre);

  if (!hasEventSignals || !hasDateOrTime) {
    return {
      isEvent: false,
      confidence: 0.15,
      reason: 'El post no contiene señales de evento, fecha u horario de convocatoria.',
    };
  }

  const confidence = hasLocationSignals ? 0.96 : 0.82;
  const candidate = parseInstagramCaption(post.caption, post.handle, post.postUrl, post.imageUrl);

  return {
    isEvent: true,
    confidence,
    reason: `Detectado evento en ${candidate.ciudad}: ${candidate.nombre} (${candidate.fecha}) con precio ${candidate.precio_texto}.`,
    candidate,
  };
}

// Ejecutar araña sobre un modo específico
export function runSpiderHarvest(mode: SpiderMode): {
  postsAnalizados: number;
  eventosAprobados: ParsedEventCandidate[];
  nuevasCuentasDescubiertas: string[];
} {
  const posts = RAW_SPIDER_POSTS.filter((p) => {
    if (mode === 'hashtag') return p.fuente === 'instagram_hashtag';
    if (mode === 'graph_expansion') return p.fuente === 'instagram_graph';
    if (mode === 'google_dork') return p.fuente === 'google_serp';
    if (mode === 'location_geotag') return p.fuente === 'geotag';
    return true;
  });

  const eventosAprobados: ParsedEventCandidate[] = [];
  const nuevasCuentas = new Set<string>();

  posts.forEach((p) => {
    const check = filterEventThroughLLM(p);
    if (check.isEvent && check.candidate) {
      eventosAprobados.push(check.candidate);
      p.menciones.forEach((m) => nuevasCuentas.add(m));
    }
  });

  return {
    postsAnalizados: posts.length,
    eventosAprobados,
    nuevasCuentasDescubiertas: Array.from(nuevasCuentas),
  };
}
