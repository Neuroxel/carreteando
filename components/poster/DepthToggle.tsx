'use client';
import { useEffect, useState } from 'react';
import { AJUSTE, guardar, leer } from './profile';
/** "Profundidad: Auto · Apagada". Se recuerda en este navegador y avisa a la escena. */
export default function DepthToggle() {
  const [valor, setValor] = useState<'auto' | 'off'>('auto');
  useEffect(() => {
    if (leer(AJUSTE) === 'off') setValor('off');
  }, []);
  const elegir = (v: 'auto' | 'off') => {
    setValor(v);
    guardar(AJUSTE, v);
    window.dispatchEvent(new Event(AJUSTE));
  };
  return (
    <div className="depth-toggle" role="group" aria-label="Profundidad del fondo">
      <span>Profundidad</span>
      {(['auto', 'off'] as const).map((v) => (
        <button key={v} type="button" aria-pressed={valor === v} onClick={() => elegir(v)}>
          {v === 'auto' ? 'Auto' : 'Apagada'}
        </button>
      ))}
    </div>
  );
}
