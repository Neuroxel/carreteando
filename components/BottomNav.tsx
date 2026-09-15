'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
const DESTINOS = [
  { href: '/', label: 'Inicio', icono: 'M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z' },
  { href: '/explorar', label: 'Explorar', icono: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4' },
  { href: '/explorar?vista=mapa', label: 'Mapa', icono: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14' },
  { href: '/publicar', label: 'Aportar', icono: 'M12 5v14M5 12h14' },
];
export default function BottomNav() {
  const pathname = usePathname();
  const params = useSearchParams();
  const enMapa = pathname === '/explorar' && params.get('vista') === 'mapa';
  const activo = (href: string) => {
    if (href === '/explorar?vista=mapa') return enMapa;
    if (href === '/explorar') return pathname === '/explorar' && !enMapa;
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };
  return (
    <nav className="bottom-nav" aria-label="Navegación rápida">
      {DESTINOS.map((d) => (
        <Link
          key={d.label}
          href={d.href}
          className={`bottom-nav-item ${activo(d.href) ? 'activo' : ''}`}
          aria-current={activo(d.href) ? 'page' : undefined}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d={d.icono} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {d.label}
        </Link>
      ))}
    </nav>
  );
}
