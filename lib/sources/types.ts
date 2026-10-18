// A source is a promise about where a row in the agenda came from. Everything an
// adapter returns carries that promise forward so the trust policy, the admin
// panel and the public page can all point at the same public URL.
export const SOURCE_TYPES = [
  'OFFICIAL_VENUE_SITE',
  'OFFICIAL_VENUE_CALENDAR',
  'PROMOTER',
  'MUNICIPALITY',
  'TICKET_PLATFORM',
  'VESTI',
  'OTHER_PUBLIC_EVENT_SOURCE',
  'INSTAGRAM',
  'COMMUNITY',
  'EDITORIAL',
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];
/**
 * auto: may publish without review. strict: publishes only when the night is
 * written without ambiguity (see decide). review: lands in the private queue.
 * evidence: recorded, never published.
 */
export type Trust = 'auto' | 'strict' | 'review' | 'evidence';
/** Who is speaking, independent of the technology used to read them. */
export const SOURCE_FAMILIES = [
  'VENUE_OFFICIAL',
  'UNIVERSITY_OFFICIAL',
  'STUDENT_ORGANIZATION',
  'CULTURAL_CENTER',
  'AUTOGESTIONADO',
  'PROMOTER',
  'COLLECTIVE',
  'ARTIST_OR_BAND',
  'MUNICIPALITY',
  'TICKET_PLATFORM',
  'PUBLIC_EVENT_DIRECTORY',
  'COMMUNITY',
  'EDITORIAL',
] as const;
export type SourceFamily = (typeof SOURCE_FAMILIES)[number];
/**
 * A: the venue or organizer speaking for itself with structured dates.
 * B: a reliable intermediary for a known venue (ticketera).
 * C: directories, universities, municipalities: real but noisy.
 * D: social posts and leads: never publish without a human.
 */
export type TrustTier = 'A' | 'B' | 'C' | 'D';
export type AccessMode = 'api' | 'html' | 'feed' | 'manual' | 'blocked';
export type Confidence = 'high' | 'medium' | 'low';
export interface SourceDefinition {
  id: string;
  name: string;
  sourceType: SourceType;
  adapter: string;
  publicUrl: string;
  commune: string;
  zone?: string | null;
  /** The venue this source speaks for, when it speaks for exactly one. */
  venueSlug?: string | null;
  venueName?: string | null;
  trust: Trust;
  family: SourceFamily;
  tier: TrustTier;
  accessMode?: AccessMode;
  /** Run the relevance classifier and drop what is clearly not a night out. */
  relevanceFilter?: boolean;
  refreshHours: number;
  /** Extra, adapter-specific configuration. Kept opaque to the dispatcher. */
  config?: Record<string, string>;
}
export interface EventCandidate {
  /** Stable across runs: the same night from the same source must collide. */
  key: string;
  title: string;
  date: string;
  time: string | null;
  venue: string | null;
  city: string;
  detailUrl: string;
  imageUrl: string | null;
  description: string | null;
  priceText: string | null;
  priceClp: number | null;
  confidence: Confidence;
  /** Why the adapter believes this, in the owner's language. */
  reasons: string[];
  categories?: string[];
  endTime?: string | null;
  /** Estado escrito por la fuente en forma estructurada (schema.org eventStatus, ICS STATUS). */
  status?: 'scheduled' | 'cancelled' | 'postponed';
  /**
   * Leída en la ficha: `agotado` solo si todas las entradas individuales lo dicen.
   * `conflicto`: la fuente se contradice (estado "disponible" sin stock ni venta);
   * no se muestra precio y el evento queda en revisión.
   */
  disponibilidad?: 'disponible' | 'agotado' | 'conflicto';
  /** Tipos de entrada tal como los publica la fuente (van a la evidencia, con su URL). */
  tiers?: { nombre: string; precio: number; agotado: boolean }[];
}
/** Lo que la base ya sabe y le sirve al adaptador para gastar mejor su presupuesto. */
export interface AdapterContext {
  /** Fichas de esta fuente que ya tienen precio guardado: se releen después de las que no. */
  conPrecio?: Set<string>;
  /** Fecha de Chile de la corrida: los adaptadores no leen el reloj por su cuenta. */
  today?: string;
}
export interface AdapterResult {
  /** Partial enrichment problems; agenda ingestion may still succeed. */
  diagnostics?: string[];
  itemsFound: number;
  candidates: EventCandidate[];
  parseFailures: number;
}
export interface Adapter {
  id: string;
  run(source: SourceDefinition, fetcher: Fetcher, ctx?: AdapterContext): Promise<AdapterResult>;
}
/** `init.headers` solo para APIs públicas que exigen una cabecera (ComediaTicket: `Country`). */
export type Fetcher = (url: string, init?: { headers?: Record<string, string> }) => Promise<{ status: number; body: string }>;
/** El plazo de la corrida se agotó antes de esta solicitud: no se pidió. */
export const PLAZO_AGOTADO = 'PLAZO_AGOTADO';
export const esPlazoAgotado = (e: unknown) => e instanceof SourceError && e.code === PLAZO_AGOTADO;
export class SourceError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}
