'use client';
import { usePathname, useSearchParams } from 'next/navigation';
import type { MouseEvent } from 'react';

type Destino = 'carretes' | 'boliches' | 'radar' | 'aportar';
// Cada nombre dice qué hay detrás: eventos, lugares, el mapa, aportar.
const DESTINOS: { id: Destino; label: string; fuera: string; icono: string }[] = [
  {
    id: 'carretes',
    label: 'Carretes',
    fuera: '/',
    // Entrada (ticket) con muesca.
    icono: 'M4 7.5V6h16v1.5a2 2 0 0 0 0 4V13a2 2 0 0 0 0 4v1H4v-1a2 2 0 0 0 0-4v-1.5a2 2 0 0 0 0-4zM14 6v12',
  },
  {
    id: 'boliches',
    label: 'Boliches',
    fuera: '/explorar?ver=lugares',
    // Fachada con toldo y puerta.
    icono: 'M4 10V20h16V10M3 10l2-5h14l2 5zM10 20v-5h4v5',
  },
  {
    id: 'radar',
    label: 'Radar',
    fuera: '/explorar?vista=mapa&ubicar=1',
    // Radar: anillos y un barrido.
    icono: 'M12 12l6-6M12 3a9 9 0 1 0 9 9M12 7.5a4.5 4.5 0 1 0 4.5 4.5M12 12h.01',
  },
  { id: 'aportar', label: 'Aportar', fuera: '/publicar', icono: 'M12 5v14M5 12h14' },
];

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
        ? 'boliches'
        : null
    : vista === 'mapa'
      ? 'radar'
      : ver === 'lugares'
        ? 'boliches'
        : 'carretes';

  const destinoEnPagina = (id: Destino) => {
    const q = new URLSearchParams();
    const ciudad = params.get('ciudad');
    if (ciudad) q.set('ciudad', ciudad);
    if (id === 'carretes' && pathname === '/explorar') q.set('fecha', 'hoy');
    if (id === 'boliches') q.set('ver', 'lugares');
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
    // Carretes vuelve arriba de todo; Boliches y Radar van directo a la cartelera.
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
