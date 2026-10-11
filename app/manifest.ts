import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Dónde Salgo?',
    short_name: 'Dónde Salgo?',
    description: 'Eventos y lugares para salir hoy en la Región de Valparaíso.',
    start_url: '/',
    display: 'standalone',
    background_color: '#100F0D',
    theme_color: '#100F0D',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  };
}
