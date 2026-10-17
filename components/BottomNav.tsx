'use client';
import Link from 'next/link';
import { useDestinos } from './Destinos';

export default function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Navegación rápida">
      {useDestinos().map((d) => (
        <Link
          key={d.id}
          prefetch={false}
          scroll={d.id === 'aportar'}
          onClick={d.onClick}
          href={d.href}
          className={`bottom-nav-item ${d.activo ? 'activo' : ''}`}
          aria-current={d.activo ? 'page' : undefined}
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
