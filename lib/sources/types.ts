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
/** auto: may publish without review. review: lands in the private queue. evidence: recorded, never published. */
export type Trust = 'auto' | 'review' | 'evidence';
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
}
export interface AdapterResult {
  itemsFound: number;
  candidates: EventCandidate[];
  parseFailures: number;
}
export interface Adapter {
  id: string;
  run(source: SourceDefinition, fetcher: Fetcher): Promise<AdapterResult>;
}
export type Fetcher = (url: string) => Promise<{ status: number; body: string }>;
export class SourceError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}
