'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { EstadoEscena } from './scene';
import {
  AJUSTE,
  SENSOR,
  depuracion,
  elegirPerfil,
  guardar,
  haySensor,
  leer,
  motivoEstatico,
  necesitaPermisoSensor,
  type Perfil,
} from './profile';

type Montaje = {
  cerrar: () => void;
  activarSensor: () => void;
  estado: () => EstadoEscena;
  simular: (beta: number, gamma: number, asentar?: boolean) => EstadoEscena;
};
type Permiso = 'no-aplica' | 'pendiente' | 'concedido' | 'denegado';

/**
 * Mejora progresiva: Three.js se descarga solo después de que la página es
 * usable y nunca con movimiento reducido. Si algo falla, queda el afiche
 * estático de PosterDecor y el sitio funciona igual.
 *
 * Sensor:
 * - iOS exige pedir permiso dentro de un toque: el botón "Activar profundidad"
 *   llama a DeviceOrientationEvent.requestPermission() directamente en el clic.
 * - Android y otros lo entregan sin permiso: se escucha de inmediato.
 * - En ambos casos, cuando llega la primera lectura real el control pasa a
 *   "Profundidad activa". Si no hay sensor o se niega, queda el puntero/scroll.
 */
export default function DepthScene() {
  const host = useRef<HTMLDivElement>(null);
  const montaje = useRef<Montaje | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [permiso, setPermiso] = useState<Permiso>('no-aplica');
  const [estado, setEstado] = useState<EstadoEscena | null>(null);
  const [debug, setDebug] = useState(false);
  const [sim, setSim] = useState({ beta: 0, gamma: 0 });

  useEffect(() => {
    let cancelado = false;
    setDebug(depuracion());
    const iniciar = async () => {
      montaje.current?.cerrar();
      montaje.current = null;
      setEstado(null);
      const p: Perfil = elegirPerfil();
      setPerfil(p);
      const decor = host.current?.parentElement;
      if (p === 'STATIC' || !decor || cancelado) return;
      try {
        const { montar } = await import('./scene');
        if (cancelado) return;
        const pide = necesitaPermisoSensor();
        const guardado = leer(SENSOR);
        const tactil = window.matchMedia?.('(pointer: coarse)').matches;
        const m = await montar(decor, host.current!, p, {
          sensor: haySensor() && (!pide ? Boolean(tactil) : guardado === 'granted'),
          alEstado: setEstado,
        });
        if (cancelado) return m.cerrar();
        montaje.current = m;
        setEstado(m.estado());
        // Una negativa de una visita anterior no bloquea: pedir de nuevo exige otro toque del usuario.
        setPermiso(!pide ? 'no-aplica' : guardado === 'granted' ? 'concedido' : 'pendiente');
        if (depuracion()) (window as unknown as { __ds3d?: Montaje }).__ds3d = m;
      } catch {
        /* sin WebGL o sin memoria: el afiche estático ya está a la vista */
      }
    };
    // Después de que la página está lista y quieta: el afiche estático ya se ve.
    const w = window as Window & {
      requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number;
    };
    if (w.requestIdleCallback) w.requestIdleCallback(() => void iniciar(), { timeout: 1500 });
    else setTimeout(() => void iniciar(), 800);
    const alCambiar = () => void iniciar();
    window.addEventListener(AJUSTE, alCambiar);
    return () => {
      cancelado = true;
      window.removeEventListener(AJUSTE, alCambiar);
      montaje.current?.cerrar();
    };
  }, []);

  // El panel de depuración refresca su lectura; nadie más lo ve.
  useEffect(() => {
    if (!debug) return;
    const t = window.setInterval(() => montaje.current && setEstado(montaje.current.estado()), 250);
    return () => window.clearInterval(t);
  }, [debug]);

  /** Se llama directo en el toque: iOS no acepta el permiso fuera de un gesto. */
  const activar = () => {
    const DOE = (
      window as unknown as {
        DeviceOrientationEvent?: { requestPermission?: () => Promise<string> };
      }
    ).DeviceOrientationEvent;
    if (!DOE?.requestPermission) {
      montaje.current?.activarSensor();
      setPermiso('no-aplica');
      return;
    }
    DOE.requestPermission()
      .then((r) => {
        const ok = r === 'granted';
        guardar(SENSOR, ok ? 'granted' : 'denied');
        setPermiso(ok ? 'concedido' : 'denegado');
        if (ok) montaje.current?.activarSensor();
      })
      .catch(() => {
        guardar(SENSOR, 'denied');
        setPermiso('denegado');
      });
  };

  const activo = estado?.sensor === 'activo';
  const tactil = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
  const pide = typeof window !== 'undefined' && necesitaPermisoSensor();
  const mostrarBoton = Boolean(estado) && tactil && pide && !activo && permiso !== 'denegado';

  const simular = (beta: number, gamma: number) => {
    setSim({ beta, gamma });
    const e = montaje.current?.simular(beta, gamma);
    if (e) setEstado(e);
  };

  return (
    <div ref={host} className="pd-host">
      {mostrarBoton && (
        <button type="button" className="pd-sensor" onClick={activar}>
          Activar profundidad
        </button>
      )}
      {activo && (
        <span className="pd-sensor pd-sensor-activo" role="status">
          Profundidad activa
        </span>
      )}
      {debug &&
        createPortal(
          <div className="pd-debug" role="region" aria-label="Depuración de profundidad">
            <p>
              perfil <b>{estado?.perfil ?? perfil ?? '…'}</b>
              {perfil === 'STATIC' && <> ({motivoEstatico() ?? 'forzado'})</>} · sensor{' '}
              <b>{haySensor() ? 'disponible' : 'no'}</b> · permiso <b>{permiso}</b> · estado{' '}
              <b>{estado?.sensor ?? '—'}</b>
            </p>
            <p>
              beta <b>{estado?.beta ?? '—'}</b> · gamma <b>{estado?.gamma ?? '—'}</b> · fps{' '}
              <b>{estado?.fps ?? '—'}</b>
            </p>
            <p>
              desplazamiento px:{' '}
              {estado?.offsets.map((o, i) => (
                <span key={i}>
                  {o.amp}→{o.px}{' '}
                </span>
              )) ?? '—'}
            </p>
            <label>
              gamma (izq/der) {sim.gamma}°
              <input
                type="range"
                min={-20}
                max={20}
                value={sim.gamma}
                onChange={(e) => simular(sim.beta, Number(e.target.value))}
              />
            </label>
            <label>
              beta (adelante/atrás) {sim.beta}°
              <input
                type="range"
                min={-15}
                max={15}
                value={sim.beta}
                onChange={(e) => simular(Number(e.target.value), sim.gamma)}
              />
            </label>
          </div>,
          document.body,
        )}
    </div>
  );
}
