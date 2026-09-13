import type { Metadata, Viewport } from 'next';
import './globals.css';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { SITE_URL, SITE_DESCRIPTION } from '../lib/site';
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'Carreteando · ¿Dónde se carretea hoy?', template: '%s · Carreteando' },
  description: SITE_DESCRIPTION,
  openGraph: {
    title: 'Carreteando · La noche es local',
    description: SITE_DESCRIPTION,
    siteName: 'Carreteando',
    locale: 'es_CL',
    type: 'website',
    images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', images: ['/opengraph-image'] },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#151614' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CL">
      <body>
        <a className="skip-link" href="#contenido">
          Ir al contenido
        </a>
        <Navbar />
        <main id="contenido">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
