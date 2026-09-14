/** Only explicit web URLs; never use untrusted URLs for server-side fetching. */
export function safeWebUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 1200 || /[\u0000-\u0020\u007f]/.test(value))
    return null;
  try {
    const u = new URL(value);
    if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password) return null;
    return u.toString();
  } catch {
    return null;
  }
}
export function safeImageUrl(value: unknown): string | null {
  const url = safeWebUrl(value);
  if (!url) return null;
  const u = new URL(url);
  if (u.protocol !== 'https:') return null;
  return /(?:^|\.)(?:cdninstagram\.com|fbcdn\.net)$/.test(u.hostname) ||
    u.hostname === 'images.unsplash.com' ||
    u.hostname === 'imagenes.passline.com' ||
    u.hostname === 'ticketing-uploads-1.ticketplus.global' ||
    u.hostname === 'events-cdn.vesti.cl' ||
    u.hostname === 'images.portaldisc.com'
    ? url
    : null;
}
