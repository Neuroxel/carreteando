'use client';
import Link from 'next/link';
import { useDestinos } from './Destinos';

/** Los mismos cuatro destinos de la barra de abajo, en la cabecera de escritorio. */
export default function NavDestinos() {
  return (
    <>
      {useDestinos().map((d) => (
        <Link
          key={d.id}
          prefetch={false}
          scroll={d.id === 'aportar'}
          onClick={d.onClick}
          href={d.href}
          className={`${d.id === 'aportar' ? 'nav-publish' : ''} ${d.activo ? 'activo' : ''}`.trim() || undefined}
          aria-current={d.activo ? 'page' : undefined}
        >
          {d.label}
          {d.id === 'aportar' && <span aria-hidden="true"> ↗</span>}
        </Link>
      ))}
    </>
  );
}
