'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { MouseEvent, ReactNode } from 'react';

/**
 * El logo siempre lleva a la portada limpia: `/` sin query, Carretes, arriba de
 * todo, sin mapa, filtro ni búsqueda. En la portada (con o sin query) el estado
 * vive en el teléfono, así que se reinicia ahí mismo en vez de navegar.
 */
export default function BrandLink({ children, className }: { children: ReactNode; className?: string }) {
  const pathname = usePathname();
  const onClick = (e: MouseEvent) => {
    if (pathname !== '/' || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (location.search || location.hash) history.pushState(null, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
    window.scrollTo({ top: 0, behavior: 'auto' });
  };
  return (
    <Link prefetch={false} className={className} href="/" aria-label="Ir al inicio de Dónde Salgo" onClick={onClick}>
      {children}
    </Link>
  );
}
