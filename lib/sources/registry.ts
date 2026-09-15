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
  portaldisc('portaldisc-cassot', 'cassotbar', 'Cassot Bar', 'cassot-bar', 'Valparaíso', 'Subida Ecuador'),
  portaldisc(
    'portaldisc-echaurren',
    'emporioechaurren',
    'Emporio Echaurren',
    'emporio-echaurren',
    'Valparaíso',
    'Plan de Valparaíso',
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
  ),
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
