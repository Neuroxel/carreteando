import { Suspense } from 'react';
import Metrics from '../components/Metrics';
import type { Metadata, Viewport } from 'next';
import './globals.css';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import BottomNav from '../components/BottomNav';
import { SITE_URL, SITE_DESCRIPTION } from '../lib/site';
import { EXPERIMENTO } from '../lib/experimento';
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'Dónde Salgo? | Eventos y lugares para salir hoy', template: '%s | Dónde Salgo?' },
  applicationName: 'Dónde Salgo?',
  description: SITE_DESCRIPTION,
  openGraph: {
    title: 'Dónde Salgo? | Eventos y lugares para salir hoy',
    description: SITE_DESCRIPTION,
    siteName: 'Dónde Salgo?',
    locale: 'es_CL',
    type: 'website',
    images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', images: ['/opengraph-image'] },
  // Edición experimental: nunca se indexa mientras no sea la elegida.
  ...(EXPERIMENTO ? { robots: { index: false, follow: false, googleBot: { index: false, follow: false } } } : {}),
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: EXPERIMENTO ? '#13131D' : '#100F0D' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CL" data-edicion={EXPERIMENTO ? '3d' : undefined}>
      <body>
        <a className="skip-link" href="#contenido">
          Ir al contenido
        </a>
        <Navbar />
        <main id="contenido">{children}</main>
        <Footer />
        <Suspense fallback={null}>
          <BottomNav />
        </Suspense>
        <Suspense fallback={null}>
          <Metrics />
        </Suspense>
      </body>
    </html>
  );
}
