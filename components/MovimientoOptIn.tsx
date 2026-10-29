'use client';
import { useEffect, useState } from 'react';
import { apagarMovimiento, movimientoPermitido, pedirPermiso } from './poster/sensor';

/**
 * Efecto de movimiento con el teléfono: apagado por defecto. Solo se enciende con
 * este toque (que en iOS además pide el permiso del sistema). Nada de la búsqueda
 * depende de él. Se oculta con movimiento reducido y en equipos sin sensores.
 */
export default function MovimientoOptIn() {
  const [visible, setVisible] = useState(false);
  const [activo, setActivo] = useState(false);
  useEffect(() => {
    const reducido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const tactil = window.matchMedia?.('(hover: none) and (pointer: coarse)').matches;
    setVisible(Boolean(tactil && !reducido && ('DeviceOrientationEvent' in window || 'DeviceMotionEvent' in window)));
    setActivo(movimientoPermitido());
  }, []);
  if (!visible) return null;
  return (
    <button
      type="button"
      className="footer-movimiento"
      aria-pressed={activo}
      onClick={() => {
        if (activo) {
          apagarMovimiento();
          setActivo(false);
        } else {
          void pedirPermiso().finally(() => setActivo(movimientoPermitido()));
        }
      }}
    >
      {activo ? 'Desactivar efecto de movimiento' : 'Activar efecto de movimiento (opcional)'}
    </button>
  );
}
