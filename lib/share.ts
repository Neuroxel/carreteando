import { SITE_URL } from './site';
/** Venue ids are prefixed by the caller; encode the slug, not its route separator. */
export function shareUrl(id: string) {
  return id.startsWith('lugar/')
    ? `${SITE_URL}/lugar/${encodeURIComponent(id.slice(6))}`
    : `${SITE_URL}/evento/${encodeURIComponent(id)}`;
}
