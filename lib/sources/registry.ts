import { portaldiscCartelera } from './adapters/portaldisc';
import { wpDatedSlug, wpEventsList, wpNewsScan } from './adapters/wordpress';
import type { Adapter, SourceDefinition } from './types';
export const ADAPTERS: Record<string, Adapter> = {
  [wpEventsList.id]: wpEventsList,
  [wpDatedSlug.id]: wpDatedSlug,
  [wpNewsScan.id]: wpNewsScan,
  [portaldiscCartelera.id]: portaldiscCartelera,
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
  trust: 'review',
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
    refreshHours: 48,
    config: { postType: 'avisos', perPage: '30' },
  },
];
export function sourceById(id: string) {
  return SOURCES.find((source) => source.id === id) || null;
}
