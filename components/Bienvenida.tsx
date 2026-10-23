'use client';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { INTENCIONES, intencionPorSlug, type SlugIntencion } from '../lib/intenciones';
import { INICIO, avanzar, type Donde, type EstadoBienvenida, type Fecha } from '../lib/bienvenida';
import type { EstadoGps } from '../lib/radar';
import { LogoApilado, Q } from './Logo';
import Pictograma from './Pictograma';
import PosterDecor from './poster/PosterDecor';

/** Tiempos (ms). Con movimiento reducido todo pasa a fundidos cortos. */
export const TIEMPOS = { golpe: 170, salida: 230, signo: 380, ticket: 480, revelar: 520 } as const;
export const TIEMPOS_REDUCIDOS = { golpe: 0, salida: 0, signo: 120, ticket: 150, revelar: 140 } as const;
const PRINCIPALES = ['Valparaíso', 'Viña del Mar', 'Quilpué', 'Villa Alemana', 'Concón'];
const DESTACADAS: SlugIntencion[] = ['bailar', 'tomar-algo', 'musica-en-vivo', 'comedia', 'karaoke'];
const GIROS = [-1.6, 1.3, -0.7, 1.5, -1.2, 0.9, -0.8, 1.1, -1.4, 0.6];
const CON_FIX: EstadoGps[] = ['precisa', 'aproximada', 'muy_aproximada'];
const SIN_FIX: EstadoGps[] = ['negado', 'no_disponible', 'timeout', 'sin_soporte'];
type Fase = 'normal' | 'eligiendo' | 'signo' | 'buscando' | 'ticket' | 'saliendo';

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
    const { golpe, salida, signo } = t();
    luego(golpe + salida, () => setFase('signo'));
    // A mitad del "?" cambia la pregunta: aparece desde detrás del signo.
    luego(golpe + salida + signo / 2, () => dispatch({ tipo: 'elegir', plan }));
    luego(golpe + salida + signo, () => {
      setFase('normal');
      setElegida(null);
      ocupado.current = false;
    });
  };
  const etiquetaFecha = (f: Fecha) => (f === 'hoy' ? 'Esta noche' : f === 'manana' ? etiquetaManana : f === 'finde' ? 'Este finde' : 'Más adelante');
  const terminar = (d: Donde) => {
    if (ocupado.current && fase !== 'buscando') return;
    ocupado.current = true;
    const lugar = d.tipo === 'cerca' ? 'Cerca de ti' : d.tipo === 'region' ? 'Toda la región' : d.ciudad;
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
  const claseAfiche = (slug: string) =>
    `bv-afiche ${elegida === slug ? 'bv-elegido' : elegida ? 'bv-se-va' : ''} ${slug === 'musica-en-vivo' ? 'bv-ancho' : ''}`;

  return (
    <div className={`bienvenida bv-fase-${fase}`} role="dialog" aria-modal="true" aria-labelledby="bienvenida-pregunta" aria-busy={fase !== 'normal'}>
      <PosterDecor variant="home" />
      {/* El "?" de la marca: quieto al fondo, crece en cada cambio de pregunta. */}
      <svg className="bv-signo" viewBox="0 -720 600 740" aria-hidden="true">
        <path className="bv-signo-sombra" d={Q} transform="translate(14 8)" />
        <path className="bv-signo-tinta" d={Q} />
      </svg>
      <div className="bienvenida-marco">
        <LogoApilado className="bienvenida-logo" decorativo />
        {s.paso === 'que' ? (
          <div className="bienvenida-paso" key="que">
            <h1 id="bienvenida-pregunta" ref={titulo} tabIndex={-1}>
              ¿Qué quieres hacer?
            </h1>
            <p className="bv-sub">Dos toques y te mostramos dónde ir.</p>
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
                  <Pictograma id={i.slug} className="bv-picto" />
                  <strong>{i.label}</strong>
                  <small>{i.descripcion}</small>
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
                    <Pictograma id={i.slug} className="bv-picto" />
                    <strong>{i.label}</strong>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="bienvenida-paso" key="donde">
            <button type="button" className="bv-memoria" onClick={() => !ocupado.current && dispatch({ tipo: 'volver' })} aria-label={`${intencionPorSlug(s.plan)?.label}: cambiar`}>
              {intencionPorSlug(s.plan)?.label} <span aria-hidden="true">✓</span>
              <span className="bv-memoria-cambiar">cambiar</span>
            </button>
            <h1 id="bienvenida-pregunta" ref={titulo} tabIndex={-1}>
              ¿Dónde?
            </h1>
            <div className="bv-muro">
              <button type="button" className={`bv-afiche bv-ancho bv-cerca ${fase === 'buscando' ? 'bv-buscando' : ''}`} style={{ ['--giro' as string]: '-0.6deg' }} onClick={cerca}>
                <span className="bv-radar" aria-hidden="true">
                  <Pictograma id="cerca" className="bv-picto" />
                </span>
                <strong>Cerca de mí</strong>
                <small role="status">{fase === 'buscando' ? 'Buscando qué hay cerca…' : 'Usa tu ubicación; no sale del teléfono'}</small>
              </button>
              {corredor.map((c, n) => (
                <button key={c} type="button" className="bv-afiche bv-afiche-lugar" style={{ ['--giro' as string]: `${GIROS[(n + 2) % GIROS.length]}deg` }} onClick={() => terminar({ tipo: 'comuna', ciudad: c })}>
                  <strong>{c}</strong>
                </button>
              ))}
              {otras &&
                resto.map((c, n) => (
                  <button key={c} type="button" className="bv-afiche bv-afiche-lugar" style={{ ['--giro' as string]: `${GIROS[(n + 4) % GIROS.length]}deg` }} onClick={() => terminar({ tipo: 'comuna', ciudad: c })}>
                    <strong>{c}</strong>
                  </button>
                ))}
            </div>
            {avisoGps && <p className="bv-aviso">No pudimos usar tu ubicación. Elige una comuna o toda la región.</p>}
            <div className="bv-secundarias">
              {resto.length > 0 && !otras && (
                <button type="button" className="bienvenida-link" onClick={() => setOtras(true)}>
                  Otras comunas
                </button>
              )}
              <button type="button" className="bienvenida-link" onClick={() => terminar({ tipo: 'region' })}>
                Toda la región
              </button>
            </div>
            <div className="bienvenida-cuando">
              <span>
                Para <strong>{etiquetaFecha(s.fecha).toLowerCase()}</strong>
              </span>
              <span aria-hidden="true">·</span>
              <button type="button" className="bienvenida-link" aria-expanded={s.cambiandoCuando} onClick={() => dispatch({ tipo: 'cambiarCuando' })}>
                Cambiar cuándo
              </button>
              {s.cambiandoCuando && (
                <div className="bienvenida-cuando-opciones" role="group" aria-label="Cuándo">
                  {(['hoy', 'manana', 'finde', 'futuro'] as Fecha[]).map((v, n) => (
                    <button key={v} type="button" className="bv-afiche bv-afiche-cuando" style={{ ['--giro' as string]: `${GIROS[n]}deg` }} aria-pressed={s.fecha === v} onClick={() => dispatch({ tipo: 'cuando', fecha: v })}>
                      <strong>{etiquetaFecha(v)}</strong>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        <button type="button" className="bienvenida-saltar" onClick={saltar}>
          Ver todo
        </button>
      </div>
      {ticket && (
        <div className="bv-ticket" aria-live="polite">
          <span>{ticket.join(' · ')}</span>
        </div>
      )}
    </div>
  );
}
