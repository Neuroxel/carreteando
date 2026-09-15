'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
const DESTINOS = [
  { href: '/', label: 'Ahora', icono: 'M12 3v18M3 12h18' },
  { href: '/buscar', label: 'Explorar', icono: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4' },
  { href: '/lugares?vista=mapa', label: 'Mapa', icono: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14' },
  { href: '/lugares', label: 'Lugares', icono: 'M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11zM12 10h.01' },
];
export default function BottomNav() {
  const pathname = usePathname();
  const params = useSearchParams();
  const enMapa = pathname === '/lugares' && params.get('vista') === 'mapa';
  const activo = (href: string) => {
    if (href === '/lugares?vista=mapa') return enMapa;
    if (href === '/lugares') return pathname.startsWith('/lugares') && !enMapa;
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
