'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { depuracion, motivoEstatico } from './profile';
import { esReal, iniciarSensores, lectura, pedirPermiso, recalibrar, simular, suscribir, type Lectura } from './sensor';

const FUENTE: Record<Lectura['fuente'], string> = {
  ORIENTATION: 'REAL ORIENTATION',
  MOTION_ACCELEROMETER: 'REAL ACCELEROMETER',
  DEBUG_SIMULATION: 'SIMULATED',
  NONE: 'NONE',
};

/**
 * Profundidad como adorno opcional, sin WebGL: cada capa del afiche con
 * `data-amp` se corre con un `transform` según la inclinación real del
 * teléfono. Sin muestras reales no pasa nada: ni bucle de dibujo ni costo.
 *
 * - Android: escucha `devicemotion` en silencio; si llegan datos, se mueve solo.
 * - iOS: el permiso exige un toque y no se interrumpe a nadie por un adorno,
 *   así que queda estático (salvo en ?3ddebug=1, que trae su propio botón).
 * - Nunca con movimiento reducido ni ahorro de datos; se pausa fuera de pantalla.
 * - No hay controles públicos: el diagnóstico vive solo en ?3ddebug=1.
 */
export default function Profundidad() {
  const host = useRef<HTMLSpanElement>(null);
  const [debug, setDebug] = useState(false);
  const [l, setL] = useState<Lectura | null>(null);
  const [offsets, setOffsets] = useState<{ amp: number; objetivo: number; px: number }[]>([]);
  const [sim, setSim] = useState({ beta: 0, gamma: 0 });

  useEffect(() => {
    const dbg = depuracion();
    setDebug(dbg);
    const decor = host.current?.parentElement;
    if (!decor || motivoEstatico()) return;
    const capas = [...decor.querySelectorAll<HTMLElement>('[data-amp]')].map((el) => ({ el, amp: Number(el.dataset.amp) }));
    let tx = 0;
    let ty = 0;
    let x = 0;
    let y = 0;
    let raf = 0;
    let visible = true;
    const pintar = () => {
      raf = 0;
      // Suavizado barato: cada cuadro recorre una fracción de lo que falta.
      x += (tx - x) * 0.16;
      y += (ty - y) * 0.16;
      for (const c of capas) c.el.style.transform = `translate3d(${(-x * c.amp).toFixed(2)}px,${(-y * c.amp).toFixed(2)}px,0)`;
      if (dbg) setOffsets(capas.map((c) => ({ amp: c.amp, objetivo: +(Math.hypot(tx, ty) * c.amp).toFixed(1), px: +(Math.hypot(x, y) * c.amp).toFixed(1) })));
      if (Math.abs(tx - x) + Math.abs(ty - y) > 0.002 && visible && !document.hidden) raf = requestAnimationFrame(pintar);
    };
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(decor);
    const soltar = suscribir((nueva) => {
      if (nueva.fuente === 'NONE') {
        // Movimiento apagado: las capas vuelven suavemente al centro, nunca quedan congeladas.
        tx = 0;
        ty = 0;
        decor.classList.remove('pd-movil');
        if (!raf && visible && !document.hidden) raf = requestAnimationFrame(pintar);
        return;
      }
      if (!esReal(nueva.fuente) && nueva.fuente !== 'DEBUG_SIMULATION') return;
      decor.classList.add('pd-movil');
      tx = nueva.tilt.x;
      ty = nueva.tilt.y;
      if (!raf && visible && !document.hidden) raf = requestAnimationFrame(pintar);
    });
    iniciarSensores();
    let t = 0;
    if (dbg) {
      t = window.setInterval(() => setL(lectura()), 250);
      (window as unknown as { __ds3d?: unknown }).__ds3d = { lectura, simular };
    }
    return () => {
      soltar();
      io.disconnect();
      cancelAnimationFrame(raf);
      window.clearInterval(t);
    };
  }, []);

  const mover = (beta: number, gamma: number) => {
    setSim({ beta, gamma });
    simular(beta, gamma);
  };

  return (
    <span ref={host} hidden>
      {debug &&
        createPortal(
          <div className="pd-debug" role="region" aria-label="Depuración de profundidad">
            <p className="pd-debug-fuente">
              INPUT SOURCE: <b>{l ? FUENTE[l.fuente] : 'NONE'}</b>
              {l && esReal(l.fuente) && l.estado !== 'recibiendo' && ' (sin muestras)'}
            </p>
            <p>
              estático por: <b>{motivoEstatico() ?? '—'}</b> · estado <b>{l?.estado ?? 'apagado'}</b> · permiso{' '}
              <b>{l?.permiso ?? '—'}</b> · muestras <b>{l?.hz ?? 0}/s</b>
            </p>
            <p>
              eventos: orientación <b>{l?.eventos.orientacion ?? 0}</b> (nulos {l?.eventos.orientacionNula ?? 0}) · movimiento{' '}
              <b>{l?.eventos.movimiento ?? 0}</b> (nulos {l?.eventos.movimientoNulo ?? 0})
            </p>
            <p>
              crudo x/y/z <b>{l?.crudo ? `${l.crudo.x} / ${l.crudo.y} / ${l.crudo.z}` : '—'}</b> · beta <b>{l?.beta ?? '—'}</b> · gamma{' '}
              <b>{l?.gamma ?? '—'}</b> · inclinación <b>{l ? `${l.tilt.x.toFixed(2)}, ${l.tilt.y.toFixed(2)}` : '—'}</b>
            </p>
            <p>
              px objetivo→real:{' '}
              {offsets.length
                ? offsets.map((o, i) => (
                    <span key={i}>
                      [{o.amp}] {o.objetivo}→{o.px}{' '}
                    </span>
                  ))
                : '—'}
            </p>
            <p className="pd-debug-acciones">
              <button type="button" onClick={() => recalibrar()}>
                Recalibrar
              </button>
              <button type="button" onClick={() => void pedirPermiso()}>
                Pedir sensor (iOS)
              </button>
            </p>
            <label>
              simular gamma {sim.gamma}°
              <input type="range" min={-15} max={15} value={sim.gamma} onChange={(e) => mover(sim.beta, Number(e.target.value))} />
            </label>
            <label>
              simular beta {sim.beta}°
              <input type="range" min={-15} max={15} value={sim.beta} onChange={(e) => mover(Number(e.target.value), sim.gamma)} />
            </label>
          </div>,
          document.body,
        )}
    </span>
  );
}
