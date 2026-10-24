import { Suspense } from 'react';
import { preload } from 'react-dom';
import Metrics from '../components/Metrics';
import type { Metadata, Viewport } from 'next';
import './globals.css';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import GradientePuntero from '../components/GradientePuntero';
import BottomNav from '../components/BottomNav';
import { SITE_URL, SITE_DESCRIPTION } from '../lib/site';
import { SCRIPT_SIN_DESTELLO } from '../lib/bienvenida';
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
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#13131D' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Edición afiche: la tipografía de máquina se ve arriba del todo; se pide temprano.
  preload('/fonts/special-elite-latin.woff2', { as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' });
  return (
    <html lang="es-CL" data-edicion="3d" suppressHydrationWarning>
      <head>
        {/* Sin destello portada → bienvenida: decide antes del primer pintado (ver lib/bienvenida). */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_SIN_DESTELLO }} />
      </head>
      <body>
        <a className="skip-link" href="#contenido">
          Ir al contenido
        </a>
        <Navbar />
        <main id="contenido">{children}</main>
        <GradientePuntero />
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
