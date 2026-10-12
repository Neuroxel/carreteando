'use client';
import { useEffect, useMemo, useRef, useState, type AnchorHTMLAttributes } from 'react';
import VenueCard from './VenueCard';
import type { Lugar } from '../lib/venues';
import { suscribir } from './poster/sensor';

const SHORT: Record<string, string> = { Valparaíso: 'Valpo', 'Viña del Mar': 'Viña' };
const MAX = 12;

/**
 * "Lugares para salir" como un riel horizontal por comuna: se elige la comuna
 * y debajo corre una sola fila. Desplazamiento nativo (swipe en el teléfono,
 * trackpad o flechas discretas en escritorio) con scroll-snap; nunca se toma
 * el scroll vertical de la página. Sin librerías de carrusel.
 *
 * Profundidad mínima: si hay sensor o puntero activos, solo la sombra impresa
 * detrás de cada tarjeta se corre unos px. El texto y el área de toque no se mueven.
 */
export default function VenueRail({
  lugares,
  inicial,
  conteo,
  hoy,
  verTodos,
}: {
  lugares: Lugar[];
  inicial: string | null;
  conteo: Map<string, number>;
  hoy: Map<string, string>;
  verTodos: (ciudad: string) => AnchorHTMLAttributes<HTMLAnchorElement>;
}) {
  const comunas = useMemo(() => {
    const n = new Map<string, number>();
    for (const l of lugares) n.set(l.ciudad, (n.get(l.ciudad) || 0) + 1);
    return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([c, k]) => ({ c, k }));
  }, [lugares]);
  const [elegida, setElegida] = useState<string | null>(null);
  const comuna = elegida && comunas.some((x) => x.c === elegida) ? elegida : inicial && comunas.some((x) => x.c === inicial) ? inicial : comunas[0]?.c;
  const deLaComuna = useMemo(() => lugares.filter((l) => l.ciudad === comuna), [lugares, comuna]);
  const pista = useRef<HTMLUListElement>(null);
  const [bordes, setBordes] = useState({ inicio: true, fin: false });

  const medir = () => {
    const t = pista.current;
    if (!t) return;
    setBordes({ inicio: t.scrollLeft < 8, fin: t.scrollLeft + t.clientWidth > t.scrollWidth - 8 });
  };
  useEffect(() => {
    pista.current?.scrollTo({ left: 0 });
    medir();
  }, [comuna]);

  // Sombra impresa que reacciona a la inclinación, solo con el riel a la vista.
  useEffect(() => {
    const t = pista.current;
    if (!t || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    let visible = false;
    let raf = 0;
    let x = 0;
    let y = 0;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(t);
    const soltar = suscribir((l) => {
      if (!visible) return;
      x = l.tilt.x;
      y = l.tilt.y;
      if (!raf)
        raf = requestAnimationFrame(() => {
          raf = 0;
          t.style.setProperty('--inc-x', x.toFixed(2));
          t.style.setProperty('--inc-y', y.toFixed(2));
        });
    });
    return () => {
      soltar();
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  const mover = (dir: 1 | -1) => {
    const t = pista.current;
    if (!t) return;
    const suave = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    t.scrollBy({ left: dir * t.clientWidth * 0.85, behavior: suave ? 'smooth' : 'auto' });
  };

  if (!comuna) return null;
  return (
    <div className="venue-rail">
      <div className="venue-rail-top">
        <div className="venue-rail-comunas" role="group" aria-label="Elegir comuna">
          {comunas.map(({ c, k }) => (
            <button key={c} type="button" aria-pressed={c === comuna} onClick={() => setElegida(c)}>
              {SHORT[c] || c} <span>{k}</span>
            </button>
          ))}
        </div>
        <div className="venue-rail-flechas">
          <button type="button" aria-label="Lugares anteriores" disabled={bordes.inicio} onClick={() => mover(-1)}>
            ←
          </button>
          <button type="button" aria-label="Más lugares" disabled={bordes.fin} onClick={() => mover(1)}>
            →
          </button>
        </div>
      </div>
      <ul className="venue-rail-pista" ref={pista} onScroll={medir} aria-label={`Lugares en ${comuna}`}>
        {deLaComuna.slice(0, MAX).map((l) => (
          <li key={l.slug}>
            <VenueCard lugar={l} proximos={conteo.get(l.nombre) || 0} hoy={hoy.get(l.nombre) || null} />
          </li>
        ))}
        {deLaComuna.length > MAX && (
          <li className="venue-rail-mas">
            <a {...verTodos(comuna)}>
              Ver los {deLaComuna.length} lugares de {SHORT[comuna] || comuna} <span aria-hidden="true">↗</span>
            </a>
          </li>
        )}
      </ul>
    </div>
  );
}
