import { portaldiscCartelera } from './adapters/portaldisc';
import { tribeEvents } from './adapters/tribe';
import { usmEventos } from './adapters/usm';
import { wpDatedSlug, wpEventsList, wpNewsScan } from './adapters/wordpress';
import type { Adapter, SourceDefinition } from './types';
export const ADAPTERS: Record<string, Adapter> = {
  [wpEventsList.id]: wpEventsList,
  [wpDatedSlug.id]: wpDatedSlug,
  [wpNewsScan.id]: wpNewsScan,
  [portaldiscCartelera.id]: portaldiscCartelera,
  [tribeEvents.id]: tribeEvents,
  [usmEventos.id]: usmEventos,
};
const portaldisc = (
  id: string,
  slug: string,
  venueName: string,
  venueSlug: string,
  commune: string,
  zone: string | null,
  refreshHours = 24,
): SourceDefinition => ({
  id,
  name: `${venueName} · cartelera PortalTickets`,
  sourceType: 'TICKET_PLATFORM',
  adapter: portaldiscCartelera.id,
  publicUrl: `https://www.portaldisc.com/cartelera/${slug}`,
  commune,
  zone,
  venueSlug,
  venueName,
  // Nivel B: la ticketera habla por un local conocido y escribe el año. Publica
  // sola únicamente cuando la fecha se lee dos veces igual y es de noche.
  trust: 'strict',
  family: 'TICKET_PLATFORM',
  tier: 'B',
  accessMode: 'html',
  refreshHours,
});
/**
 * Every source here was probed before it was written down: it answers, it is
 * public, and its robots.txt allows us. A source that stops meeting that is
 * deactivated in the registry, not quietly left to fail every night.
 */
export const SOURCES: SourceDefinition[] = [
  {
    id: 'pcdv-agenda',
    name: 'Parque Cultural de Valparaíso · agenda oficial',
    sourceType: 'OFFICIAL_VENUE_CALENDAR',
    adapter: wpEventsList.id,
    publicUrl: 'https://parquecultural.cl',
    commune: 'Valparaíso',
    zone: 'Cerro Cárcel',
    venueSlug: 'parque-cultural-valparaiso',
    venueName: 'Parque Cultural de Valparaíso',
    trust: 'auto',
    family: 'CULTURAL_CENTER',
    tier: 'A',
    accessMode: 'api',
    refreshHours: 24,
    config: { postType: 'events_list', perPage: '40' },
  },
  {
    id: 'cinzano-agenda',
    name: 'Bar Cinzano · programación oficial',
    sourceType: 'OFFICIAL_VENUE_SITE',
    adapter: wpDatedSlug.id,
    publicUrl: 'https://cinzanooficial.cl',
    commune: 'Valparaíso',
    zone: 'Plan de Valparaíso',
    venueSlug: 'bar-cinzano',
    venueName: 'Bar Cinzano',
    trust: 'auto',
    family: 'VENUE_OFFICIAL',
    tier: 'A',
    accessMode: 'api',
    refreshHours: 24,
    config: { postType: 'cinzano_event', perPage: '40' },
  },
  portaldisc('portaldisc-cassot', 'cassotbar', 'Cassot Bar', 'cassot-bar', 'Valparaíso', 'Subida Ecuador', 48),
  portaldisc(
    'portaldisc-echaurren',
    'emporioechaurren',
    'Emporio Echaurren',
    'emporio-echaurren',
    'Valparaíso',
    'Plan de Valparaíso',
    48,
  ),
  portaldisc(
    'portaldisc-pcdv',
    'parquecultural',
    'Parque Cultural de Valparaíso',
    'parque-cultural-valparaiso',
    'Valparaíso',
    'Cerro Cárcel',
    48,
  ),
  portaldisc(
    'portaldisc-teatromauri',
    'teatromauriscd',
    'Teatro Mauri SCD',
    'teatro-mauri-scd',
    'Valparaíso',
    'Plan de Valparaíso',
    48,
  ),
  // Las dieciséis carteleras que ya existían en la ticketera y esperaban
  // adaptador. Todas probadas antes de registrarse: responden, tienen la
  // estructura esperada y su robots.txt lo permite.
  portaldisc('portaldisc-trotamundos', 'trotamundosvalparaiso', 'Trotamundos Valparaíso', 'trotamundos-valparaiso', 'Valparaíso', 'Plan de Valparaíso', 48),
  portaldisc('portaldisc-elpasaje', 'elpasaje', 'El Pasaje', 'el-pasaje', 'Viña del Mar', 'Viña Norte', 48),
  portaldisc('portaldisc-barvienes', 'barvienes', 'Bar Vienés', 'bar-vienes', 'Viña del Mar', 'Viña Centro', 48),
  portaldisc('portaldisc-casacultura', 'casadelaculturadevalparaiso', 'Casa de la Cultura de Valparaíso', 'casa-de-la-cultura-valparaiso', 'Valparaíso', 'Barrio Puerto', 48),
  portaldisc('portaldisc-espaciobarcelona', 'espaciobarcelona', 'Espacio Barcelona', 'espacio-barcelona', 'Valparaíso', 'El Almendral', 48),
  portaldisc('portaldisc-segundopiso', 'clubsegundopiso', 'Club Segundo Piso', 'club-segundo-piso', 'Valparaíso', 'El Almendral', 48),
  portaldisc('portaldisc-clubaleman', 'clubalemandevalparaiso', 'Club Alemán de Valparaíso', 'club-aleman-valparaiso', 'Valparaíso', 'Plan de Valparaíso', 48),
  portaldisc('portaldisc-lacolombina', 'lacolombina', 'La Colombina', 'la-colombina', 'Valparaíso', 'Cerro Alegre', 48),
  portaldisc('portaldisc-laparakultural', 'laparakulturalvalparaiso', 'La Pará Kultural', 'la-para-kultural', 'Valparaíso', 'Barrio Puerto', 48),
  portaldisc('portaldisc-lemutt', 'lemuttbar', 'Lemutt Bar', 'lemutt-bar', 'Valparaíso', 'Plan de Valparaíso', 48),
  portaldisc('portaldisc-alquinta', 'losalquintadelpuerto', 'Los Alquinta del Puerto', 'los-alquinta-del-puerto', 'Valparaíso', 'El Almendral', 48),
  portaldisc('portaldisc-multiespacio', 'multiespaciocondell', 'Multiespacio Condell', 'multiespacio-condell', 'Valparaíso', 'Plan de Valparaíso', 48),
  portaldisc('portaldisc-panichouse', 'panichouse', 'Panic House', 'panic-house', 'Valparaíso', 'Barrio Puerto', 48),
  portaldisc('portaldisc-espantapajaros', 'espantapajaroskaraoke', 'Espantapájaros Karaoke', 'espantapajaros-karaoke', 'Valparaíso', 'Subida Ecuador', 48),
  portaldisc('portaldisc-espaciomusa', 'espaciomusa', 'Espacio Musa', 'espacio-musa', 'Quilpué', 'Quilpué Centro', 48),
  portaldisc('portaldisc-municipalvina', 'municipal-vinadelmar', 'Teatro Municipal de Viña del Mar', 'teatro-municipal-vina', 'Viña del Mar', 'Viña Centro', 48),
  {
    id: 'muni-valparaiso',
    name: 'Municipalidad de Valparaíso · comunicados',
    sourceType: 'MUNICIPALITY',
    adapter: wpNewsScan.id,
    publicUrl: 'https://www.municipalidaddevalparaiso.cl',
    commune: 'Valparaíso',
    zone: null,
    trust: 'review',
    family: 'MUNICIPALITY',
    tier: 'C',
    accessMode: 'api',
    refreshHours: 48,
    config: { postType: 'posts', perPage: '30' },
  },
  {
    id: 'munivina-avisos',
    name: 'Municipalidad de Viña del Mar · avisos',
    sourceType: 'MUNICIPALITY',
    adapter: wpNewsScan.id,
    publicUrl: 'https://www.munivina.cl',
    commune: 'Viña del Mar',
    zone: null,
    trust: 'review',
    family: 'MUNICIPALITY',
    tier: 'C',
    accessMode: 'api',
    refreshHours: 48,
    config: { postType: 'avisos', perPage: '30' },
  },
  {
    // La agenda cultural regional más completa que encontramos con API
    // pública: teatros, bares con música, centros culturales, ferias y la
    // cartelera de Duoc. Es un directorio: nada se publica sin revisión.
    id: 'valpocultura-agenda',
    name: 'Valpo Cultura · agenda regional',
    sourceType: 'OTHER_PUBLIC_EVENT_SOURCE',
    adapter: tribeEvents.id,
    publicUrl: 'https://valpocultura.cl',
    commune: 'Valparaíso',
    zone: null,
    trust: 'review',
    family: 'PUBLIC_EVENT_DIRECTORY',
    tier: 'C',
    accessMode: 'api',
    relevanceFilter: true,
    refreshHours: 24,
  },
  {
    id: 'usm-eventos',
    name: 'Universidad Técnica Federico Santa María · eventos',
    sourceType: 'OTHER_PUBLIC_EVENT_SOURCE',
    adapter: usmEventos.id,
    publicUrl: 'https://usm.cl',
    commune: 'Valparaíso',
    zone: null,
    trust: 'review',
    family: 'UNIVERSITY_OFFICIAL',
    tier: 'C',
    accessMode: 'api',
    relevanceFilter: true,
    refreshHours: 48,
  },
];
/**
 * Fuentes públicas que vale la pena mirar a mano pero que no leemos con un
 * programa: o no tienen una forma estructurada, o se protegen con un desafío
 * anti-bots que no vamos a saltar. Quedan registradas para que el panel muestre
 * el mapa completo y nadie las "descubra" de nuevo.
 */
export interface ManualSource {
  id: string;
  name: string;
  publicUrl: string;
  commune: string;
  family: SourceDefinition['family'];
  accessMode: 'manual' | 'blocked';
  notes: string;
}
export const MANUAL_SOURCES: ManualSource[] = [
  {
    id: 'uv-agenda',
    name: 'Universidad de Valparaíso · agenda',
    publicUrl: 'https://www.uv.cl',
    commune: 'Valparaíso',
    family: 'UNIVERSITY_OFFICIAL',
    accessMode: 'blocked',
    notes: 'Protegido por un desafío anti-bots (Radware). Solo revisión manual; no se intenta saltar.',
  },
  {
    id: 'pucv-agenda',
    name: 'Pontificia Universidad Católica de Valparaíso · agenda',
    publicUrl: 'https://www.pucv.cl',
    commune: 'Valparaíso',
    family: 'UNIVERSITY_OFFICIAL',
    accessMode: 'manual',
    notes: 'Agenda institucional en HTML sin fechas estructuradas; casi todo es académico.',
  },
  {
    id: 'upla-agenda',
    name: 'Universidad de Playa Ancha · calendario',
    publicUrl: 'https://www.upla.cl',
    commune: 'Valparaíso',
    family: 'UNIVERSITY_OFFICIAL',
    accessMode: 'manual',
    notes: 'Usa The Events Calendar pero estaba vacío al revisarlo (oct 2026). Si se llena, pasa al adaptador tribe-events.',
  },
  {
    id: 'puntos-cultura',
    name: 'Puntos de Cultura · Ministerio de las Culturas',
    publicUrl: 'https://puntos.cultura.gob.cl',
    commune: 'Valparaíso',
    family: 'CULTURAL_CENTER',
    accessMode: 'manual',
    notes: 'Registro oficial de espacios culturales comunitarios. La API pide credenciales (401): sirve para descubrir lugares a mano, no eventos.',
  },
];
export function sourceById(id: string) {
  return SOURCES.find((source) => source.id === id) || null;
}
