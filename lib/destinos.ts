/** Los cuatro destinos de la navegación. Cada nombre dice qué hay detrás: eventos, lugares, el mapa, aportar. */
export type Destino = 'carretes' | 'lugares' | 'radar' | 'aportar';
export const DESTINOS: { id: Destino; label: string; fuera: string; icono: string }[] = [
  {
    id: 'carretes',
    label: 'Carretes',
    fuera: '/',
    // Entrada (ticket) con muesca.
    icono: 'M4 7.5V6h16v1.5a2 2 0 0 0 0 4V13a2 2 0 0 0 0 4v1H4v-1a2 2 0 0 0 0-4v-1.5a2 2 0 0 0 0-4zM14 6v12',
  },
  {
    id: 'lugares',
    label: 'Lugares',
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
