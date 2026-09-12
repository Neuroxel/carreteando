import type { Metadata } from 'next';
import './globals.css';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export const metadata: Metadata = {
  title: 'Carretes V Región — Fiestas, Universitarios & Under en Valparaíso y Viña',
  description:
    'El buscador centralizado de carretes, mechoneos universitarios, fiestas under y tocatas en Valparaíso, Viña del Mar, Reñaca y Quilpué. Todo lo que pasa en Instagram, en un solo lugar.',
  keywords: [
    'carretes valparaiso',
    'fiestas vina del mar',
    'eventos valpo',
    'mechoneo valparaiso',
    'carrete universitario valpo',
    'underground techno valparaiso',
    'el huevo valparaiso',
    'subida ecuador carrete',
    'fiestas reñaca',
    'trotamundos quilpue',
  ],
  openGraph: {
    title: 'Carretes V Región — El Buscador Centralizado de Eventos',
    description:
      '¿Dónde se carretea hoy en Valpo o Viña? Descubre fiestas universitarias, raves under, cumbia y tocatas centralizadas desde Instagram.',
    url: 'https://carretes.vercel.app',
    siteName: 'Carretes V Región',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80',
        width: 1200,
        height: 630,
        alt: 'Carretes Valparaíso',
      },
    ],
    locale: 'es_CL',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Carretes V Región — ¿Dónde se carretea hoy?',
    description:
      'Centralizador de carretes universitarios y fiestas under en la V Región de Chile.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        <Navbar />
        <main style={{ minHeight: 'calc(100vh - 160px)' }}>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
