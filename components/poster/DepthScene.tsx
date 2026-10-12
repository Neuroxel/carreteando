'use client';
import { useEffect, useRef, useState } from 'react';
import { AJUSTE, SENSOR, elegirPerfil, guardar, leer, necesitaPermisoSensor, type Perfil } from './profile';

type Montaje = { cerrar: () => void; activarSensor: () => void };
/**
 * Mejora progresiva: Three.js se descarga solo después de que la página es
 * usable, solo si el equipo lo aguanta y nunca con movimiento reducido. Si algo
 * falla, queda el afiche estático de PosterDecor y el sitio funciona igual.
 */
export default function DepthScene() {
  const host = useRef<HTMLDivElement>(null);
  const montaje = useRef<Montaje | null>(null);
  const [pedirSensor, setPedirSensor] = useState(false);

  useEffect(() => {
    let cancelado = false;
    const iniciar = async () => {
      montaje.current?.cerrar();
      montaje.current = null;
      const perfil: Perfil = elegirPerfil();
      const decor = host.current?.parentElement;
      if (perfil === 'STATIC' || !decor || cancelado) return;
      try {
        const { montar } = await import('./scene');
        if (cancelado) return;
        const sensorAuto = !necesitaPermisoSensor() && window.matchMedia?.('(pointer: coarse)').matches;
        montaje.current = await montar(decor, host.current!, perfil, {
          sensor: sensorAuto || leer(SENSOR) === 'granted',
        });
        setPedirSensor(necesitaPermisoSensor() && !leer(SENSOR));
      } catch {
        /* sin WebGL o sin memoria: el afiche estático ya está a la vista */
      }
    };
    // Después de que la página está lista y quieta: el afiche estático ya se ve.
    const w = window as Window & { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(() => void iniciar(), { timeout: 2500 });
    else setTimeout(() => void iniciar(), 1200);
    const alCambiar = () => void iniciar();
    window.addEventListener(AJUSTE, alCambiar);
    return () => {
      cancelado = true;
      window.removeEventListener(AJUSTE, alCambiar);
      montaje.current?.cerrar();
    };
  }, []);

  const activar = async () => {
    setPedirSensor(false);
    try {
      const DOE = (window as unknown as { DeviceOrientationEvent: { requestPermission: () => Promise<string> } }).DeviceOrientationEvent;
      const r = await DOE.requestPermission();
      guardar(SENSOR, r === 'granted' ? 'granted' : 'denied');
      if (r === 'granted') montaje.current?.activarSensor();
    } catch {
      guardar(SENSOR, 'denied');
    }
  };

  return (
    <div ref={host} className="pd-host">
      {pedirSensor && (
        <button type="button" className="pd-sensor" onClick={activar}>
          Activar profundidad
        </button>
      )}
    </div>
  );
}
