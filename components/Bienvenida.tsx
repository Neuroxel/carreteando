'use client';
import { useEffect, useReducer, useRef } from 'react';
import { INTENCIONES, type SlugIntencion } from '../lib/intenciones';
import { INICIO, avanzar, type Donde, type EstadoBienvenida, type Fecha } from '../lib/bienvenida';
import { LogoApilado } from './Logo';

const SHORT: Record<string, string> = { Valparaíso: 'Valparaíso', 'Viña del Mar': 'Viña del Mar' };
const PRINCIPALES = ['Valparaíso', 'Viña del Mar', 'Quilpué', 'Villa Alemana', 'Concón'];

/**
 * Bienvenida a pantalla completa: una sola pregunta a la vez, sin cartelera,
 * buscador ni filtros detrás. "Ver todo" siempre cierra. Los pasos no tocan el
 * historial; solo el final (onTerminar) escribe la URL filtrada.
 */
export default function Bienvenida({
  intenciones,
  comunas,
  etiquetaManana,
  onTerminar,
  onSaltar,
}: {
  /** Intenciones con oferta (las vacías no se ofrecen). */
  intenciones: SlugIntencion[];
  /** Comunas con oferta, además de las principales. */
  comunas: string[];
  etiquetaManana: string;
  onTerminar: (s: EstadoBienvenida, d: Donde) => void;
  onSaltar: () => void;
}) {
  const [s, dispatch] = useReducer(avanzar, INICIO);
  const titulo = useRef<HTMLHeadingElement>(null);
  // Foco en la pregunta de cada paso; Escape = Ver todo; la página de atrás no se desplaza.
  useEffect(() => titulo.current?.focus(), [s.paso]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onSaltar();
    document.addEventListener('keydown', esc);
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', esc);
      document.body.style.overflow = antes;
    };
  }, [onSaltar]);
  const lista = [...PRINCIPALES.filter((c) => comunas.includes(c)), ...comunas.filter((c) => !PRINCIPALES.includes(c))];
  const cuando: [Fecha, string][] = [
    ['hoy', 'Esta noche'],
    ['manana', etiquetaManana],
    ['finde', 'Este finde'],
    ['futuro', 'Más adelante'],
  ];
  return (
    <div className="bienvenida" role="dialog" aria-modal="true" aria-labelledby="bienvenida-pregunta">
      <div className="bienvenida-marco">
        <LogoApilado className="bienvenida-logo" decorativo />
        {s.paso === 'que' ? (
          <div className="bienvenida-paso" key="que">
            <h1 id="bienvenida-pregunta" ref={titulo} tabIndex={-1}>
              ¿Qué quieres hacer?
            </h1>
            <div className="bienvenida-opciones">
              {INTENCIONES.filter((i) => intenciones.includes(i.slug)).map((i) => (
                <button key={i.slug} type="button" className="bienvenida-opcion" onClick={() => dispatch({ tipo: 'elegir', plan: i.slug })}>
                  <span aria-hidden="true">{i.icono}</span>
                  <span>
                    <strong>{i.label}</strong>
                    <small>{i.descripcion}</small>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="bienvenida-paso" key="donde">
            <h1 id="bienvenida-pregunta" ref={titulo} tabIndex={-1}>
              ¿Dónde?
            </h1>
            <div className="bienvenida-opciones bienvenida-opciones-donde">
              <button type="button" className="bienvenida-opcion" onClick={() => onTerminar(s, { tipo: 'cerca' })}>
                <span aria-hidden="true">📍</span>
                <strong>Cerca de mí</strong>
              </button>
              <button type="button" className="bienvenida-opcion" onClick={() => onTerminar(s, { tipo: 'region' })}>
                <strong>Toda la región</strong>
              </button>
              {lista.map((c) => (
                <button key={c} type="button" className="bienvenida-opcion" onClick={() => onTerminar(s, { tipo: 'comuna', ciudad: c })}>
                  <strong>{SHORT[c] || c}</strong>
                </button>
              ))}
            </div>
            <div className="bienvenida-cuando">
              <span>
                Para: <strong>{cuando.find(([v]) => v === s.fecha)?.[1]}</strong>
              </span>
              <button type="button" className="bienvenida-link" aria-expanded={s.cambiandoCuando} onClick={() => dispatch({ tipo: 'cambiarCuando' })}>
                Cambiar cuándo
              </button>
              {s.cambiandoCuando && (
                <div className="bienvenida-cuando-opciones" role="group" aria-label="Cuándo">
                  {cuando.map(([v, label]) => (
                    <button key={v} type="button" aria-pressed={s.fecha === v} onClick={() => dispatch({ tipo: 'cuando', fecha: v })}>
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button type="button" className="bienvenida-link" onClick={() => dispatch({ tipo: 'volver' })}>
              ← Volver
            </button>
          </div>
        )}
        <button type="button" className="bienvenida-saltar" onClick={onSaltar}>
          Ver todo
        </button>
      </div>
    </div>
  );
}
