'use client';
import { usePathname, useSearchParams } from 'next/navigation';
import type { MouseEvent } from 'react';

import { DESTINOS, type Destino } from '../lib/destinos';

/**
 * En la portada y en explorar, la barra cambia el estado de la página en el
 * teléfono (sin pedir nada al servidor) y escribe la URL, así atrás/adelante
 * funcionan. La ciudad elegida se mantiene; lo demás vuelve al punto de partida
 * de cada destino.
 */
export function useDestinos() {
  const pathname = usePathname();
  const params = useSearchParams();
  const discovery = pathname === '/' || pathname === '/explorar';
  const vista = params.get('vista') === 'mapa' ? 'mapa' : 'lista';
  const ver = params.get('ver');
  const activo: Destino | null = !discovery
    ? pathname.startsWith('/publicar')
      ? 'aportar'
      : pathname.startsWith('/lugar')
        ? 'lugares'
        : null
    : vista === 'mapa'
      ? 'radar'
      : ver === 'lugares'
        ? 'lugares'
        : 'carretes';

  const destinoEnPagina = (id: Destino) => {
    const q = new URLSearchParams();
    const ciudad = params.get('ciudad');
    if (ciudad) q.set('ciudad', ciudad);
    // Radar conserva comuna y zona, igual que el botón Mapa (un solo estado de Radar).
    const zona = params.get('zona');
    if (id === 'radar' && ciudad && zona) q.set('zona', zona);
    if (id === 'carretes' && pathname === '/explorar') q.set('fecha', 'hoy');
    if (id === 'lugares') q.set('ver', 'lugares');
    if (id === 'radar') q.set('vista', 'mapa');
    const cadena = q.toString();
    return cadena ? `${pathname}?${cadena}` : pathname;
  };

  const tocar = (id: Destino) => (e: MouseEvent) => {
    if (!discovery || id === 'aportar' || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    const url = destinoEnPagina(id);
    if (url !== location.pathname + location.search) history.pushState(null, '', url);
    window.dispatchEvent(new PopStateEvent('popstate'));
    if (id === 'radar') window.dispatchEvent(new Event('radar:abrir'));
    // Carretes vuelve arriba de todo; Lugares y Radar van directo a la cartelera.
    const destino = id === 'carretes' ? null : document.getElementById('cartelera');
    const top = destino ? destino.getBoundingClientRect().top + window.scrollY - 8 : 0;
    window.scrollTo({ top, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };

  return DESTINOS.map((d) => ({
    ...d,
    href: discovery && d.id !== 'aportar' ? destinoEnPagina(d.id) : d.fuera,
    onClick: tocar(d.id),
    activo: activo === d.id,
  }));
}
