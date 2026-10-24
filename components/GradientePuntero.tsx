'use client';
import { useEffect } from 'react';

/**
 * Un brillo suave que sigue al puntero, solo en equipos con mouse (hover fino) y
 * sin movimiento reducido. En táctil no existe: no hay puntero que seguir. Un
 * cuadro por movimiento como máximo; nada que bloquee la navegación.
 */
export default function GradientePuntero() {
  useEffect(() => {
    const mq = window.matchMedia?.('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
    if (!mq) return;
    const raiz = document.documentElement;
    let raf = 0;
    let x = 0;
    let y = 0;
    const pintar = () => {
      raf = 0;
      raiz.style.setProperty('--px', `${x}px`);
      raiz.style.setProperty('--py', `${y}px`);
    };
    const mover = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      x = e.clientX;
      y = e.clientY;
      if (!raf) raf = requestAnimationFrame(pintar);
    };
    const aplicar = () => {
      raiz.classList.toggle('con-puntero', mq.matches);
      if (mq.matches) window.addEventListener('pointermove', mover, { passive: true });
      else window.removeEventListener('pointermove', mover);
    };
    aplicar();
    mq.addEventListener?.('change', aplicar);
    return () => {
      mq.removeEventListener?.('change', aplicar);
      window.removeEventListener('pointermove', mover);
      if (raf) cancelAnimationFrame(raf);
      raiz.classList.remove('con-puntero');
    };
  }, []);
  return null;
}
