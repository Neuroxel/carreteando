'use client';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { INTENCIONES, intencionPorSlug, type SlugIntencion } from '../lib/intenciones';
import { INICIO, avanzar, type Donde, type EstadoBienvenida, type Fecha } from '../lib/bienvenida';
import type { EstadoGps } from '../lib/radar';
import { LogoApilado, Q } from './Logo';
import Pictograma from './Pictograma';
import Ilustracion from './Ilustracion';
import {
  ajustarPorCuadros,
  leerDispositivo,
  medirCuadros,
  nivelInicial,
  type Nivel,
} from '../lib/capacidad';
import PosterDecor from './poster/PosterDecor';
import { movimientoPermitido } from './poster/sensor';

/** Tiempos (ms). Con movimiento reducido todo pasa a fundidos cortos. */
export const TIEMPOS = { golpe: 170, giro: 720, ticket: 420, revelar: 680 } as const;
export const TIEMPOS_REDUCIDOS = { golpe: 0, giro: 120, ticket: 150, revelar: 150 } as const;
const PRINCIPALES = ['Valparaíso', 'Viña del Mar', 'Quilpué', 'Villa Alemana', 'Concón'];
const DESTACADAS: SlugIntencion[] = [
  'bailar',
  'tomar-algo',
  'musica-en-vivo',
  'comedia',
  'karaoke',
];
const GIROS = [-1.6, 1.3, -0.7, 1.5, -1.2, 0.9, -0.8, 1.1, -1.4, 0.6];
const CON_FIX: EstadoGps[] = ['precisa', 'aproximada', 'muy_aproximada'];
const SIN_FIX: EstadoGps[] = ['negado', 'no_disponible', 'timeout', 'sin_soporte'];
type Fase = 'normal' | 'eligiendo' | 'girando' | 'buscando' | 'ticket' | 'saliendo';
/** Papel con canto: capas de "ladrillo" detrás y el papel encima (extrusión falsa, barata). */
function Capas() {
  return (
    <>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <span key={i} className={`bv-canto bv-canto-${i}`} aria-hidden="true" />
      ))}
      <span className="bv-papel" aria-hidden="true" />
    </>
  );
}

/**
 * Bienvenida "Afiche Vivo": afiches pegados en un muro nocturno, una pregunta
 * a la vez. El "?" de la marca hace la transición. Solo transform y opacity.
 * Todo queda bloqueado mientras anima: un toque se ejecuta una sola vez.
 */
export default function Bienvenida({
  intenciones,
  comunas,
  etiquetaManana,
  gps,
  onCerca,
  onTerminar,
  onSaltar,
  onCerrado,
}: {
  intenciones: SlugIntencion[];
  comunas: string[];
  etiquetaManana: string;
  gps: EstadoGps;
  /** Pide la ubicación con el mismo GPS de Radar (gesto). */
  onCerca: () => void;
  /** Aplica la elección a la portada (que sigue tapada). */
  onTerminar: (s: EstadoBienvenida, d: Donde) => void;
  /** Deja la portada limpia (sigue tapada). */
  onSaltar: () => void;
  /** Fin de la revelación: la bienvenida sale del DOM. */
  onCerrado: () => void;
}) {
  const [s, dispatch] = useReducer(avanzar, INICIO);
  const [fase, setFase] = useState<Fase>('normal');
  const [elegida, setElegida] = useState<string | null>(null);
  const [ticket, setTicket] = useState<string[] | null>(null);
  const [otras, setOtras] = useState(false);
  const [avisoGps, setAvisoGps] = useState(false);
  const titulo = useRef<HTMLHeadingElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const ocupado = useRef(false);
  const reducido = useRef(false);
  const raiz = useRef<HTMLDivElement>(null);
  // Nivel de efectos según el dispositivo; una medición real de cuadros solo puede bajarlo.
  const [nivel, setNivel] = useState<Nivel>('baja');
  useEffect(() => {
    const inicial = nivelInicial(leerDispositivo());
    setNivel(inicial);
    if (inicial === 'baja') return;
    let vivo = true;
    medirCuadros().then((ms) => vivo && setNivel((n) => ajustarPorCuadros(n, ms)));
    return () => {
      vivo = false;
    };
  }, []);
  // Luz que sigue al puntero o, si la persona lo activó, al giroscopio.
  const moverLuz = (x: number, y: number) => {
    const el = raiz.current;
    if (!el) return;
    el.style.setProperty('--luz-x', `${(x * 100).toFixed(1)}%`);
    el.style.setProperty('--luz-y', `${(y * 100).toFixed(1)}%`);
  };
  useEffect(() => {
    // El giroscopio solo si la persona activó el movimiento con un toque explícito.
    if (nivel === 'baja' || !movimientoPermitido()) return;
    const orientar = (e: DeviceOrientationEvent) => {
      if (e.beta == null || e.gamma == null) return;
      const gx = Math.max(-30, Math.min(30, e.gamma)) / 60 + 0.5;
      const gy = Math.max(-30, Math.min(30, e.beta - 40)) / 60 + 0.5;
      moverLuz(gx, gy);
      escena.current?.style.setProperty('--incl-y', `${((gx - 0.5) * 10).toFixed(2)}deg`);
      escena.current?.style.setProperty('--incl-x', `${((0.5 - gy) * 8).toFixed(2)}deg`);
    };
    window.addEventListener('deviceorientation', orientar);
    return () => window.removeEventListener('deviceorientation', orientar);
  }, [nivel]);
  // Cada afiche se inclina hacia el dedo/puntero y deja ver su canto (solo nivel alto).
  const inclinarAfiche = (e: { target: EventTarget | null; clientX: number; clientY: number }) => {
    if (nivel !== 'alta') return;
    const a = (e.target as HTMLElement | null)?.closest?.('.bv-afiche') as HTMLElement | null;
    if (!a) return;
    const r = a.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    a.style.setProperty('--ry', `${(px * 16).toFixed(2)}deg`);
    a.style.setProperty('--rx', `${(py * -12).toFixed(2)}deg`);
    a.style.setProperty('--ex', `${(-px * 2.2).toFixed(2)}px`);
    a.style.setProperty('--ey', `${(-py * 2.2 + 0.6).toFixed(2)}px`);
    a.style.setProperty('--sx', `${(50 + px * 70).toFixed(1)}%`);
  };
  const soltarAfiche = (e: { target: EventTarget | null }) => {
    const a = (e.target as HTMLElement | null)?.closest?.('.bv-afiche') as HTMLElement | null;
    a?.style.removeProperty('--ry');
    a?.style.removeProperty('--rx');
    a?.style.removeProperty('--ex');
    a?.style.removeProperty('--ey');
    a?.style.removeProperty('--sx');
  };
  const t = () => (reducido.current ? TIEMPOS_REDUCIDOS : TIEMPOS);
  const luego = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms));

  useEffect(() => {
    reducido.current = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    // Ya hay bienvenida en pantalla: se quita el telón anti-destello.
    document.documentElement.classList.remove('bv-pendiente');
    const lista = timers.current;
    return () => lista.forEach(clearTimeout);
  }, []);
  useEffect(() => {
    if (fase === 'normal') titulo.current?.focus({ preventScroll: true });
  }, [s.paso, fase]);

  const salir = useCallback(
    (aplicar: () => void) => {
      aplicar();
      setFase('saliendo');
      document.documentElement.classList.add('bv-revela');
      luego(t().revelar, () => {
        onCerrado();
        luego(80, () => document.documentElement.classList.remove('bv-revela'));
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onCerrado],
  );
  const saltar = useCallback(() => {
    if (fase === 'saliendo') return;
    timers.current.forEach(clearTimeout);
    ocupado.current = true;
    salir(onSaltar);
  }, [fase, onSaltar, salir]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && saltar();
    document.addEventListener('keydown', esc);
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', esc);
      document.body.style.overflow = antes;
    };
  }, [saltar]);

  const elegir = (plan: SlugIntencion) => {
    if (ocupado.current) return;
    ocupado.current = true;
    dispatch({ tipo: 'tocar', plan });
    setElegida(plan);
    setFase('eligiendo');
    const { golpe, giro } = t();
    // Tras el golpe, la carta gira en 3D: al otro lado está ¿Dónde?.
    luego(golpe, () => {
      dispatch({ tipo: 'elegir', plan });
      setFase('girando');
    });
    luego(golpe + giro, () => {
      setFase('normal');
      setElegida(null);
      ocupado.current = false;
    });
  };
  const irDonde = () => {
    if (ocupado.current) return;
    ocupado.current = true;
    dispatch({ tipo: 'irDonde' });
    setFase('girando');
    luego(t().giro, () => {
      setFase('normal');
      ocupado.current = false;
    });
  };
  const volver = () => {
    if (ocupado.current) return;
    ocupado.current = true;
    dispatch({ tipo: 'volver' });
    setFase('girando');
    luego(t().giro, () => {
      setFase('normal');
      ocupado.current = false;
    });
  };
  // Volumen: la carta se inclina levemente hacia el dedo o el puntero (nunca en movimiento reducido).
  const escena = useRef<HTMLDivElement>(null);
  const inclinar = (e: { clientX: number; clientY: number }) => {
    const el = escena.current;
    if (!el || reducido.current) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty(
      '--incl-x',
      `${(((e.clientY - r.top) / r.height - 0.5) * -6).toFixed(2)}deg`,
    );
    el.style.setProperty(
      '--incl-y',
      `${(((e.clientX - r.left) / r.width - 0.5) * 8).toFixed(2)}deg`,
    );
  };
  const etiquetaFecha = (f: Fecha) =>
    f === 'hoy'
      ? 'Esta noche'
      : f === 'manana'
        ? etiquetaManana
        : f === 'finde'
          ? 'Este finde'
          : 'Más adelante';
  const terminar = (d: Donde) => {
    if (ocupado.current && fase !== 'buscando') return;
    ocupado.current = true;
    const lugar =
      d.tipo === 'cerca' ? 'Cerca de ti' : d.tipo === 'region' ? 'Toda la región' : d.ciudad;
    setTicket([intencionPorSlug(s.plan)?.label || 'Planes', lugar, etiquetaFecha(s.fecha)]);
    setFase('ticket');
    luego(t().ticket, () => salir(() => onTerminar(s, d)));
  };
  const cerca = () => {
    if (ocupado.current) return;
    setAvisoGps(false);
    if (CON_FIX.includes(gps)) return terminar({ tipo: 'cerca' });
    ocupado.current = true;
    setFase('buscando');
    onCerca();
  };
  // Mientras busca: con un punto, confirma y sigue; sin permiso o sin señal, sin drama: comunas.
  useEffect(() => {
    if (fase !== 'buscando') return;
    if (CON_FIX.includes(gps)) {
      const id = setTimeout(() => terminar({ tipo: 'cerca' }), reducido.current ? 0 : 260);
      return () => clearTimeout(id);
    }
    if (SIN_FIX.includes(gps)) {
      setFase('normal');
      setAvisoGps(true);
      ocupado.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gps, fase]);

  const visibles = INTENCIONES.filter((i) => intenciones.includes(i.slug));
  const grandes = visibles.filter((i) => DESTACADAS.includes(i.slug));
  const chicas = visibles.filter((i) => !DESTACADAS.includes(i.slug));
  const corredor = PRINCIPALES.filter((c) => comunas.includes(c));
  const resto = comunas.filter((c) => !PRINCIPALES.includes(c));
  // Sin huecos en el muro: si queda un afiche solo en su fila, ocupa el ancho completo.
  const celdas = grandes.reduce((n, i) => n + (i.slug === 'musica-en-vivo' ? 2 : 1), 0);
  const ultimo = celdas % 2 === 1 ? grandes[grandes.length - 1]?.slug : null;
  const claseAfiche = (slug: string) =>
    `bv-afiche ${elegida === slug ? 'bv-elegido' : elegida ? 'bv-se-va' : ''} ${slug === 'musica-en-vivo' || slug === ultimo ? 'bv-ancho' : ''}`;

  return (
    <div
      ref={raiz}
      className={`bienvenida bv-fase-${fase}`}
      data-nivel={nivel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="bienvenida-pregunta"
      aria-busy={fase !== 'normal'}
      onPointerMove={(e) => {
        moverLuz(e.clientX / window.innerWidth, e.clientY / window.innerHeight);
        inclinarAfiche(e);
      }}
      onPointerOut={soltarAfiche}
    >
      <PosterDecor variant="home" />
      {/* Flechas sueltas, como una constelación de afiche: decorativas, al fondo. */}
      <svg
        className="bv-flechas"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth=".35"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        >
          <path
            vectorEffect="non-scaling-stroke"
            d="M0 0H8.0M6.0 -1.6L8.0 0L6.0 1.6M0 0l-1.5 -1.5M0 0l-1.5 1.5M1.5 0l-1.5 -1.5M1.5 0l-1.5 1.5"
            transform="translate(86.0 32.1) rotate(250)"
          />
          <path
            vectorEffect="non-scaling-stroke"
            d="M0 0H9.7M7.699999999999999 -1.6L9.7 0L7.699999999999999 1.6M0 0l-1.5 -1.5M0 0l-1.5 1.5M1.5 0l-1.5 -1.5M1.5 0l-1.5 1.5"
            transform="translate(57.7 45.8) rotate(302)"
          />
          <path
            vectorEffect="non-scaling-stroke"
            d="M0 0H8.5M6.5 -1.6L8.5 0L6.5 1.6M0 0l-1.5 -1.5M0 0l-1.5 1.5M1.5 0l-1.5 -1.5M1.5 0l-1.5 1.5"
            transform="translate(47.5 65.8) rotate(22)"
          />
          <path
            vectorEffect="non-scaling-stroke"
            d="M0 0H6.4M4.4 -1.6L6.4 0L4.4 1.6M0 0l-1.5 -1.5M0 0l-1.5 1.5M1.5 0l-1.5 -1.5M1.5 0l-1.5 1.5"
            transform="translate(64.1 97.3) rotate(296)"
          />
          <path
            vectorEffect="non-scaling-stroke"
            d="M0 0H7.3M5.3 -1.6L7.3 0L5.3 1.6M0 0l-1.5 -1.5M0 0l-1.5 1.5M1.5 0l-1.5 -1.5M1.5 0l-1.5 1.5"
            transform="translate(39.0 66.2) rotate(8)"
          />
          <path
            vectorEffect="non-scaling-stroke"
            d="M0 0H8.8M6.800000000000001 -1.6L8.8 0L6.800000000000001 1.6M0 0l-1.5 -1.5M0 0l-1.5 1.5M1.5 0l-1.5 -1.5M1.5 0l-1.5 1.5"
            transform="translate(18.1 13.2) rotate(21)"
          />
          <path
            vectorEffect="non-scaling-stroke"
            d="M0 0H9.4M7.4 -1.6L9.4 0L7.4 1.6M0 0l-1.5 -1.5M0 0l-1.5 1.5M1.5 0l-1.5 -1.5M1.5 0l-1.5 1.5"
            transform="translate(14.4 25.8) rotate(141)"
          />
          <path
            vectorEffect="non-scaling-stroke"
            d="M0 0H9.4M7.4 -1.6L9.4 0L7.4 1.6M0 0l-1.5 -1.5M0 0l-1.5 1.5M1.5 0l-1.5 -1.5M1.5 0l-1.5 1.5"
            transform="translate(9.7 45.1) rotate(198)"
          />
          <path
            vectorEffect="non-scaling-stroke"
            d="M0 0H7.1M5.1 -1.6L7.1 0L5.1 1.6M0 0l-1.5 -1.5M0 0l-1.5 1.5M1.5 0l-1.5 -1.5M1.5 0l-1.5 1.5"
            transform="translate(80.7 84.9) rotate(100)"
          />
          <path
            vectorEffect="non-scaling-stroke"
            d="M0 0H5.8M3.8 -1.6L5.8 0L3.8 1.6M0 0l-1.5 -1.5M0 0l-1.5 1.5M1.5 0l-1.5 -1.5M1.5 0l-1.5 1.5"
            transform="translate(36.4 86.9) rotate(345)"
          />
          <path
            vectorEffect="non-scaling-stroke"
            d="M0 0H7.4M5.4 -1.6L7.4 0L5.4 1.6M0 0l-1.5 -1.5M0 0l-1.5 1.5M1.5 0l-1.5 -1.5M1.5 0l-1.5 1.5"
            transform="translate(18.9 24.3) rotate(84)"
          />
          <path
            vectorEffect="non-scaling-stroke"
            d="M0 0H7.1M5.1 -1.6L7.1 0L5.1 1.6M0 0l-1.5 -1.5M0 0l-1.5 1.5M1.5 0l-1.5 -1.5M1.5 0l-1.5 1.5"
            transform="translate(58.6 27.2) rotate(1)"
          />
          <path
            vectorEffect="non-scaling-stroke"
            d="M0 0H8.5M6.5 -1.6L8.5 0L6.5 1.6M0 0l-1.5 -1.5M0 0l-1.5 1.5M1.5 0l-1.5 -1.5M1.5 0l-1.5 1.5"
            transform="translate(37.4 56.4) rotate(343)"
          />
          <path
            vectorEffect="non-scaling-stroke"
            d="M0 0H5.3M3.3 -1.6L5.3 0L3.3 1.6M0 0l-1.5 -1.5M0 0l-1.5 1.5M1.5 0l-1.5 -1.5M1.5 0l-1.5 1.5"
            transform="translate(51.5 61.3) rotate(243)"
          />
          <path
            vectorEffect="non-scaling-stroke"
            d="M0 0H9.0M7.0 -1.6L9.0 0L7.0 1.6M0 0l-1.5 -1.5M0 0l-1.5 1.5M1.5 0l-1.5 -1.5M1.5 0l-1.5 1.5"
            transform="translate(88.4 76.9) rotate(315)"
          />
          <path
            vectorEffect="non-scaling-stroke"
            d="M0 0H8.2M6.199999999999999 -1.6L8.2 0L6.199999999999999 1.6M0 0l-1.5 -1.5M0 0l-1.5 1.5M1.5 0l-1.5 -1.5M1.5 0l-1.5 1.5"
            transform="translate(39.7 40.3) rotate(37)"
          />
        </g>
      </svg>
      {/* El "?" de la marca: quieto al fondo, crece en cada cambio de pregunta. */}
      <svg className="bv-signo" viewBox="0 -720 600 740" aria-hidden="true">
        <path className="bv-signo-sombra" d={Q} transform="translate(14 8)" />
        <path className="bv-signo-tinta" d={Q} />
      </svg>
      <div className="bienvenida-marco">
        <LogoApilado className="bienvenida-logo" decorativo />
        {/* Menú con volumen: una carta 3D. Al frente ¿Qué quieres hacer?, al dorso ¿Dónde?. */}
        <div className="bv-escena" ref={escena} onPointerMove={inclinar}>
          <div className={`bv-carta ${s.paso === 'donde' ? 'bv-girada' : ''}`}>
            <div
              className="bienvenida-paso bv-cara bv-frente"
              aria-hidden={s.paso !== 'que'}
              inert={s.paso !== 'que' ? true : undefined}
            >
              <h1
                id={s.paso === 'que' ? 'bienvenida-pregunta' : undefined}
                ref={s.paso === 'que' ? titulo : undefined}
                tabIndex={-1}
              >
                ¿Qué quieres hacer?
              </h1>
              <p className="bv-sub bv-tira">
                Dos toques y te mostramos dónde ir.{' '}
                <button type="button" className="bienvenida-link bv-primero-donde" onClick={irDonde}>
                  O elige primero dónde →
                </button>
              </p>
              <div className="bv-muro">
                {grandes.map((i, n) => (
                  <button
                    key={i.slug}
                    type="button"
                    className={claseAfiche(i.slug)}
                    style={{ ['--giro' as string]: `${GIROS[n % GIROS.length]}deg` }}
                    onClick={() => elegir(i.slug)}
                    aria-pressed={elegida === i.slug}
                  >
                    <Capas />
                    <span className="bv-cinta" aria-hidden="true" />
                    <span className="bv-afiche-texto">
                      <Pictograma id={i.slug} className="bv-picto" />
                      <strong>{i.label}</strong>
                      <small>{i.descripcion}</small>
                    </span>
                    <Ilustracion id={i.slug} className="bv-ilustracion" />
                  </button>
                ))}
              </div>
              {chicas.length > 0 && (
                <div className="bv-muro bv-muro-chico">
                  {chicas.map((i, n) => (
                    <button
                      key={i.slug}
                      type="button"
                      className={`${claseAfiche(i.slug)} bv-afiche-chico`}
                      style={{ ['--giro' as string]: `${GIROS[(n + 5) % GIROS.length]}deg` }}
                      onClick={() => elegir(i.slug)}
                      aria-pressed={elegida === i.slug}
                    >
                      <Capas />
                      <Pictograma id={i.slug} className="bv-picto" />
                      <strong>{i.label}</strong>
                      <Ilustracion id={i.slug} className="bv-ilustracion bv-ilustracion-chica" />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div
              className="bienvenida-paso bv-cara bv-dorso"
              aria-hidden={s.paso !== 'donde'}
              inert={s.paso !== 'donde' ? true : undefined}
            >
              <button
                type="button"
                className="bv-memoria"
                onClick={volver}
                aria-label={s.plan ? `${intencionPorSlug(s.plan)?.label}: cambiar` : 'Elegir qué quieres hacer (opcional)'}
              >
                {s.plan ? (
                  <>
                    {intencionPorSlug(s.plan)?.label} <span aria-hidden="true">✓</span>
                    <span className="bv-memoria-cambiar">cambiar</span>
                  </>
                ) : (
                  <>
                    Todo tipo de plan <span className="bv-memoria-cambiar">elegir qué (opcional)</span>
                  </>
                )}
              </button>
              <h1
                id={s.paso === 'donde' ? 'bienvenida-pregunta' : undefined}
                ref={s.paso === 'donde' ? titulo : undefined}
                tabIndex={-1}
              >
                ¿Dónde?
              </h1>
              <div className="bv-muro">
                <button
                  type="button"
                  className={`bv-afiche bv-ancho bv-cerca ${fase === 'buscando' ? 'bv-buscando' : ''}`}
                  style={{ ['--giro' as string]: '-0.6deg' }}
                  onClick={cerca}
                >
                  <Capas />
                  <span className="bv-radar" aria-hidden="true">
                    <Pictograma id="cerca" className="bv-picto" />
                  </span>
                  <strong>Cerca de mí</strong>
                  <small role="status">
                    {fase === 'buscando'
                      ? 'Buscando qué hay cerca…'
                      : 'Usa tu ubicación; no sale del teléfono'}
                  </small>
                </button>
                {corredor.map((c, n) => (
                  <button
                    key={c}
                    type="button"
                    className="bv-afiche bv-afiche-lugar"
                    style={{ ['--giro' as string]: `${GIROS[(n + 2) % GIROS.length]}deg` }}
                    onClick={() => terminar({ tipo: 'comuna', ciudad: c })}
                  >
                    <Capas />
                    <strong>{c}</strong>
                  </button>
                ))}
                {otras &&
                  resto.map((c, n) => (
                    <button
                      key={c}
                      type="button"
                      className="bv-afiche bv-afiche-lugar"
                      style={{ ['--giro' as string]: `${GIROS[(n + 4) % GIROS.length]}deg` }}
                      onClick={() => terminar({ tipo: 'comuna', ciudad: c })}
                    >
                      <Capas />
                      <strong>{c}</strong>
                    </button>
                  ))}
              </div>
              {avisoGps && (
                <p className="bv-aviso">
                  No pudimos usar tu ubicación. Elige una comuna o toda la región.
                </p>
              )}
              <div className="bv-secundarias">
                {resto.length > 0 && !otras && (
                  <button type="button" className="bienvenida-link" onClick={() => setOtras(true)}>
                    Otras comunas
                  </button>
                )}
                <button
                  type="button"
                  className="bienvenida-link"
                  onClick={() => terminar({ tipo: 'region' })}
                >
                  Toda la región
                </button>
              </div>
              <div className="bienvenida-cuando">
                <span>
                  Para <strong>{etiquetaFecha(s.fecha).toLowerCase()}</strong>
                </span>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  className="bienvenida-link"
                  aria-expanded={s.cambiandoCuando}
                  onClick={() => dispatch({ tipo: 'cambiarCuando' })}
                >
                  Cambiar cuándo
                </button>
                {s.cambiandoCuando && (
                  <div className="bienvenida-cuando-opciones" role="group" aria-label="Cuándo">
                    {(['hoy', 'manana', 'finde', 'futuro'] as Fecha[]).map((v, n) => (
                      <button
                        key={v}
                        type="button"
                        className="bv-afiche bv-afiche-cuando"
                        style={{ ['--giro' as string]: `${GIROS[n]}deg` }}
                        aria-pressed={s.fecha === v}
                        onClick={() => dispatch({ tipo: 'cuando', fecha: v })}
                      >
                        <Capas />
                        <strong>{etiquetaFecha(v)}</strong>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        <button type="button" className="bienvenida-saltar" onClick={saltar}>
          Ver todo
        </button>
      </div>
      {/* Luz: fugas y rayos que siguen al puntero/giroscopio (media y alta). */}
      <div className="bv-luz" aria-hidden="true" />
      {/* Cine: barras de letterbox y destello en los cambios (media y alta). */}
      <div className="bv-cine bv-cine-a" aria-hidden="true" />
      <div className="bv-cine bv-cine-b" aria-hidden="true" />
      <div className="bv-destello" aria-hidden="true" />
      {ticket && (
        <div className="bv-ticket" aria-live="polite">
          <span>{ticket.join(' · ')}</span>
        </div>
      )}
    </div>
  );
}
