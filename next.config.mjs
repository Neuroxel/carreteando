import { fileURLToPath } from 'node:url';
/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: fileURLToPath(new URL('.', import.meta.url)),
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.cdninstagram.com' },
      { protocol: 'https', hostname: '**.fbcdn.net' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'imagenes.passline.com' },
      { protocol: 'https', hostname: 'ticketing-uploads-1.ticketplus.global' },
      { protocol: 'https', hostname: 'events-cdn.vesti.cl' },
      { protocol: 'https', hostname: 'images.portaldisc.com' },
      // Sitios oficiales de los propios lugares y municipios: de ahí sale el
      // cartel que el organizador publicó para anunciar su evento.
      { protocol: 'https', hostname: 'parquecultural.cl' },
      { protocol: 'https', hostname: 'cinzanooficial.cl' },
      { protocol: 'https', hostname: 'municipalidaddevalparaiso.cl' },
      { protocol: 'https', hostname: 'www.municipalidaddevalparaiso.cl' },
      { protocol: 'https', hostname: 'www.munivina.cl' },
      { protocol: 'https', hostname: 'lacalera.cl' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: "object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
          },
        ],
      },
    ];
  },
};
export default nextConfig;
