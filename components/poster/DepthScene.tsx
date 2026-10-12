'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { EstadoEscena } from './scene';
import { AJUSTE, depuracion, elegirPerfil, motivoEstatico, type Perfil } from './profile';
import {
  esReal,
  iniciarSensores,
  lectura,
  pedirPermiso,
  recalibrar,
  requierePermiso,
  simular as simularSensor,
  suscribir,
  type Lectura,
} from './sensor';

type Montaje = {
  cerrar: () => void;
  estado: () => EstadoEscena;
  asentar: (dibujar?: boolean) => EstadoEscena;
};

const NOMBRE_FUENTE: Record<Lectura['fuente'], string> = {
  ORIENTATION: 'REAL ORIENTATION',
  MOTION_ACCELEROMETER: 'REAL ACCELEROMETER',
  POINTER: 'POINTER',
  DEBUG_SIMULATION: 'SIMULATED',
  NONE: 'NONE',
};

/**
 * Mejora progresiva: Three.js se descarga solo después de que la página es
 * usable y nunca con movimiento reducido. Si algo falla, queda el afiche
 * estático de PosterDecor y el sitio funciona igual.
 *
 * Los sensores (sensor.ts) se escuchan desde el principio en pantallas
 * táctiles: la escena llega después y lee la inclinación que ya hay.
 * - iOS: el botón "Activar profundidad" pide movimiento y orientación dentro
 *   del toque.
 * - Android: no hay permiso; si a los 1,5 s no llegan números, el botón
 *   aparece igual para reintentar dentro de un gesto.
 * - "Profundidad activa" solo aparece con muestras reales llegando. Tocarlo
 *   fija la postura actual como cero.
 */
export default function DepthScene() {
  const host = useRef<HTMLDivElement>(null);
  const montaje = useRef<Montaje | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [escena, setEscena] = useState<EstadoEscena | null>(null);
  const [sensor, setSensor] = useState<Lectura | null>(null);
  const [tactil, setTactil] = useState(false);
  const [debug, setDebug] = useState(false);
  const [sim, setSim] = useState({ beta: 0, gamma: 0 });

  useEffect(() => {
    let cancelado = false;
    const dbg = depuracion();
    setDebug(dbg);
    const esTactil = Boolean(window.matchMedia?.('(pointer: coarse)').matches);
    setTactil(esTactil);
    // La UI del sensor se refresca a lo sumo 4 veces por segundo; la escena lee directo.
    let ultimoAviso = 0;
    let ultimoEstado = '';
    const soltar = suscribir((l) => {
      const t = performance.now();
      if (l.estado + l.fuente !== ultimoEstado || t - ultimoAviso > 250) {
        ultimoAviso = t;
        ultimoEstado = l.estado + l.fuente;
        setSensor(lectura());
      }
    });
    const iniciar = async () => {
      montaje.current?.cerrar();
      montaje.current = null;
      setEscena(null);
      const p: Perfil = elegirPerfil();
      setPerfil(p);
      const decor = host.current?.parentElement;
      if (p === 'STATIC' || !decor || cancelado) return;
      // Escuchar ya: en Android y escritorio no hay permiso; en iOS, si ya se
      // concedió antes, las muestras llegan sin tocar nada.
      iniciarSensores();
      try {
        const { montar } = await import('./scene');
        if (cancelado) return;
        const m = await montar(decor, host.current!, p, { alEstado: setEscena });
        if (cancelado) return m.cerrar();
        montaje.current = m;
        setEscena(m.estado());
        if (dbg) (window as unknown as { __ds3d?: unknown }).__ds3d = { ...m, simular: simularYAsentar, lectura };
      } catch {
        /* sin WebGL o sin memoria: el afiche estático ya está a la vista */
      }
    };
    const w = window as Window & {
      requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number;
    };
    // Primero carga la página y su imagen principal (LCP); 3 s después, en un
    // momento ocioso, recién se arma la escena. Hasta entonces se ve el afiche
    // estático, que en reposo es idéntico al lienzo.
    const arrancar = () =>
      window.setTimeout(() => {
        if (w.requestIdleCallback) w.requestIdleCallback(() => void iniciar(), { timeout: 2000 });
        else void iniciar();
      }, 3000);
    if (document.readyState === 'complete') arrancar();
    else window.addEventListener('load', arrancar, { once: true });
    const alCambiar = () => void iniciar();
    window.addEventListener(AJUSTE, alCambiar);
    return () => {
      cancelado = true;
      soltar();
      window.removeEventListener(AJUSTE, alCambiar);
      montaje.current?.cerrar();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // El panel de depuración refresca su lectura; nadie más lo ve.
  useEffect(() => {
    if (!debug) return;
    const t = window.setInterval(() => {
      setSensor(lectura());
      if (montaje.current) setEscena(montaje.current.estado());
    }, 250);
    return () => window.clearInterval(t);
  }, [debug]);

  function simularYAsentar(beta: number, gamma: number) {
    simularSensor(beta, gamma);
    return montaje.current?.asentar();
  }

  /** Se llama directo en el toque: iOS no acepta el permiso fuera de un gesto. */
  const activar = () => {
    void pedirPermiso().then(() => setSensor(lectura()));
  };

  const recibiendo = Boolean(sensor && esReal(sensor.fuente) && sensor.estado === 'recibiendo');
  const mostrarBoton =
    Boolean(escena) &&
    tactil &&
    !recibiendo &&
    sensor?.permiso !== 'denegado' &&
    (requierePermiso() || sensor?.estado === 'sin-datos');

  const simular = (beta: number, gamma: number) => {
    setSim({ beta, gamma });
    const e = simularYAsentar(beta, gamma);
    if (e) setEscena(e);
    setSensor(lectura());
  };

  return (
    <div ref={host} className="pd-host">
      {mostrarBoton && (
        <button type="button" className="pd-sensor" onClick={activar}>
          Activar profundidad
        </button>
      )}
      {recibiendo && escena && (
        <button
          type="button"
          className="pd-sensor pd-sensor-activo"
          onClick={() => recalibrar()}
          aria-label="Profundidad activa. Tocar para recentrar"
        >
          Profundidad activa
        </button>
      )}
      {debug &&
        createPortal(
          <div className="pd-debug" role="region" aria-label="Depuración de profundidad">
            <p className="pd-debug-fuente">
              INPUT SOURCE: <b>{sensor ? NOMBRE_FUENTE[sensor.fuente] : 'NONE'}</b>
              {sensor && esReal(sensor.fuente) && sensor.estado !== 'recibiendo' && ' (sin muestras)'}
            </p>
            <p>
              perfil <b>{escena?.perfil ?? perfil ?? '…'}</b>
              {perfil === 'STATIC' && <> ({motivoEstatico() ?? 'forzado'})</>} · estado{' '}
              <b>{sensor?.estado ?? 'apagado'}</b> · permiso <b>{sensor?.permiso ?? '—'}</b> · muestras{' '}
              <b>{sensor?.hz ?? 0}/s</b> · fps <b>{escena?.fps ?? '—'}</b>
            </p>
            <p>
              eventos: orientación <b>{sensor?.eventos.orientacion ?? 0}</b> (nulos {sensor?.eventos.orientacionNula ?? 0}) ·
              movimiento <b>{sensor?.eventos.movimiento ?? 0}</b> (nulos {sensor?.eventos.movimientoNulo ?? 0})
            </p>
            <p>
              crudo x/y/z <b>{sensor?.crudo ? `${sensor.crudo.x} / ${sensor.crudo.y} / ${sensor.crudo.z}` : '—'}</b> · beta{' '}
              <b>{sensor?.beta ?? '—'}</b> · gamma <b>{sensor?.gamma ?? '—'}</b>
            </p>
            <p>
              inclinación normalizada x <b>{sensor ? sensor.tilt.x.toFixed(2) : '—'}</b> · y{' '}
              <b>{sensor ? sensor.tilt.y.toFixed(2) : '—'}</b>
            </p>
            <p>
              px objetivo→real:{' '}
              {escena?.offsets.map((o, i) => (
                <span key={i}>
                  [{o.amp}] {o.objetivo}→{o.px}{' '}
                </span>
              )) ?? '—'}
            </p>
            <p className="pd-debug-acciones">
              <button type="button" onClick={() => recalibrar()}>
                Recalibrar
              </button>
              {tactil && !recibiendo && (
                <button type="button" onClick={activar}>
                  Pedir sensor
                </button>
              )}
            </p>
            <label>
              simular gamma (izq/der) {sim.gamma}°
              <input type="range" min={-20} max={20} value={sim.gamma} onChange={(e) => simular(sim.beta, Number(e.target.value))} />
            </label>
            <label>
              simular beta (adelante/atrás) {sim.beta}°
              <input type="range" min={-15} max={15} value={sim.beta} onChange={(e) => simular(Number(e.target.value), sim.gamma)} />
            </label>
          </div>,
          document.body,
        )}
    </div>
  );
}
