import { Q } from '../Logo';
import DepthScene from './DepthScene';
/**
 * El "mundo" detrás del hero, como un afiche impreso en capas: papel tramado,
 * nubes de tinta, formas grandes, el "?" impreso en tres tintas corridas y una
 * capa de imprenta al frente (marcas de registro, trama, cinta). Es SVG estático
 * renderizado en el servidor: sin JavaScript ni WebGL el sitio se ve así,
 * completo. Si el equipo lo permite, DepthScene toma cada elemento con
 * `data-amp` como un plano propio y lo mueve según su profundidad:
 * `data-amp` = desplazamiento máximo en px, `data-z` = profundidad del plano.
 * Cada capa es aria-hidden; solo el botón opcional del sensor es un control real.
 */
const RINGS = [
  { s: 0.47, cx: 790, cy: 322, color: 'var(--accent-2)', o: 0.55, w: 16, amp: 19 },
  { s: 0.36, cx: 805, cy: 304, color: 'var(--accent)', o: 0.42, w: 20, amp: 17 },
  { s: 0.27, cx: 818, cy: 290, color: 'var(--accent-2)', o: 0.32, w: 24, amp: 15 },
  { s: 0.2, cx: 829, cy: 280, color: 'var(--lila, #B9A3DA)', o: 0.24, w: 30, amp: 13 },
];
// El "?" de Archivo Black mide ~611 × 700 unidades y apoya en y = 0.
const at = (s: number, cx: number, cy: number, rot = -6) =>
  `translate(${cx - (611 * s) / 2} ${cy + (700 * s) / 2}) scale(${s}) rotate(${rot} 305 -350)`;

/** Bordes de imprenta: la tinta no cae perfecta. */
function Rough({ id, scale = 6, freq = 0.04 }: { id: string; scale?: number; freq?: number }) {
  return (
    <filter id={id} x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency={freq} numOctaves="3" seed="3" />
      <feDisplacementMap in="SourceGraphic" scale={scale} />
    </filter>
  );
}
/** Tinta con densidad desigual: poros de grano dentro del bloque y borde gastado. */
function Mottle({ id }: { id: string }) {
  return (
    <filter id={id} x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="11" result="n" />
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.4 1.75" result="m" />
      <feComposite in="SourceGraphic" in2="m" operator="in" result="g" />
      <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="5" result="w" />
      <feDisplacementMap in="g" in2="w" scale="7" />
    </filter>
  );
}

export default function PosterDecor({ variant }: { variant: 'home' | 'small' }) {
  return (
    <div className={`poster-decor poster-${variant}`}>
      {/* Z0 · papel tramado profundo (lleva el desplazamiento "líquido") */}
      <svg className="pd-layer" data-amp="6" data-z="-2.6" data-liquid="1" aria-hidden="true" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id="pd-dots" width="9" height="9" patternUnits="userSpaceOnUse">
            <circle cx="4.5" cy="4.5" r="2.4" fill="var(--accent-2)" />
          </pattern>
          <radialGradient id="pd-fade">
            <stop offset="0" stopColor="#fff" stopOpacity="1" />
            <stop offset="0.6" stopColor="#fff" stopOpacity="0.55" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <mask id="pd-m1"><ellipse cx="170" cy="560" rx="460" ry="250" fill="url(#pd-fade)" /></mask>
          <mask id="pd-m2"><ellipse cx="900" cy="40" rx="340" ry="170" fill="url(#pd-fade)" /></mask>
          <Rough id="pd-rough0" scale={22} freq={0.035} />
          <Mottle id="pd-mottle0" />
        </defs>
        <g filter="url(#pd-rough0)">
          <rect width="1000" height="600" fill="url(#pd-dots)" mask="url(#pd-m1)" opacity="0.55" />
          <rect width="1000" height="600" fill="url(#pd-dots)" mask="url(#pd-m2)" opacity="0.4" />
        </g>
        <g filter="url(#pd-mottle0)" opacity="0.55">
          <path d="M-20 420 C 120 360, 260 470, 420 430 S 640 520, 760 600 L -20 620 Z" fill="#2A2C45" />
          <path d="M600 -20 C 700 60, 860 20, 1020 90 L 1020 -20 Z" fill="#2A2C45" />
        </g>
      </svg>

      {/* Z1 · nubes de tinta y halo */}
      <svg className="pd-layer" data-amp="12" data-z="-1.8" aria-hidden="true" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="pd-halo">
            <stop offset="0" stopColor="var(--lila, #B9A3DA)" stopOpacity="0.42" />
            <stop offset="1" stopColor="var(--lila, #B9A3DA)" stopOpacity="0" />
          </radialGradient>
          <pattern id="pd-dots2" width="14" height="14" patternUnits="userSpaceOnUse">
            <circle cx="7" cy="7" r="3.4" fill="var(--lila, #B9A3DA)" />
          </pattern>
          <radialGradient id="pd-fade2">
            <stop offset="0" stopColor="#fff" stopOpacity="1" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <mask id="pd-m3"><ellipse cx="690" cy="470" rx="220" ry="100" fill="url(#pd-fade2)" /></mask>
          <mask id="pd-m4"><ellipse cx="330" cy="70" rx="200" ry="80" fill="url(#pd-fade2)" /></mask>
          <Rough id="pd-rough1" scale={14} freq={0.05} />
        </defs>
        <circle cx="800" cy="300" r="290" fill="url(#pd-halo)" />
        <g filter="url(#pd-rough1)">
          <rect width="1000" height="600" fill="url(#pd-dots2)" mask="url(#pd-m3)" opacity="0.32" />
          <rect width="1000" height="600" fill="url(#pd-dots2)" mask="url(#pd-m4)" opacity="0.18" />
        </g>
      </svg>

      {/* Z2 · formas grandes: el túnel de "?" que se aleja */}
      <svg className="pd-layer" aria-hidden="true" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice">
        <defs>
          <Rough id="pd-rough2" scale={5} freq={0.06} />
        </defs>
        {RINGS.map((r, i) => (
          <g key={i} data-amp={r.amp} data-z={-1.0 - i * 0.18} transform={at(r.s, r.cx, r.cy)} opacity={r.o} filter="url(#pd-rough2)">
            <path d={Q} fill="none" stroke={r.color} strokeWidth={r.w} strokeLinejoin="round" />
          </g>
        ))}
      </svg>

      {/* Z3 · el "?" focal impreso en tres tintas con fuera de registro */}
      <svg className="pd-layer pd-focal" aria-hidden="true" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice">
        <defs>
          <Mottle id="pd-mottle3" />
          <Rough id="pd-rough3" scale={4} freq={0.08} />
        </defs>
        <g data-amp="24" data-z="0.2" transform={at(0.62, 786, 354)} filter="url(#pd-mottle3)" opacity="0.9">
          <path d={Q} fill="#2A2C45" />
        </g>
        <g data-amp="26" data-z="0.45" transform={at(0.62, 776, 344)} filter="url(#pd-mottle3)" opacity="0.62">
          <path d={Q} fill="var(--accent)" />
        </g>
        <g data-amp="28" data-z="0.7" transform={at(0.62, 770, 338)} filter="url(#pd-rough3)" opacity="0.9">
          <path d={Q} fill="none" stroke="var(--papel-tinta, #F1E6DE)" strokeWidth="11" strokeLinejoin="round" />
        </g>
      </svg>

      {/* Z4 · imprenta al frente: marcas de registro, cinta, trama de esquina */}
      <svg className="pd-layer pd-front" data-amp="32" data-z="1.2" aria-hidden="true" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id="pd-dots4" width="7" height="7" patternUnits="userSpaceOnUse">
            <circle cx="3.5" cy="3.5" r="1.7" fill="var(--accent)" />
          </pattern>
          <radialGradient id="pd-fade4">
            <stop offset="0" stopColor="#fff" stopOpacity="1" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <mask id="pd-m5"><circle cx="985" cy="590" r="150" fill="url(#pd-fade4)" /></mask>
          <Rough id="pd-rough4" scale={6} freq={0.07} />
        </defs>
        <rect width="1000" height="600" fill="url(#pd-dots4)" mask="url(#pd-m5)" opacity="0.5" />
        <g stroke="var(--papel-tinta, #F1E6DE)" strokeWidth="2" opacity="0.55" fill="none">
          <g transform="translate(968 34)"><circle r="11" /><path d="M-19 0H19M0 -19V19" /></g>
          <g transform="translate(968 566)"><circle r="11" /><path d="M-19 0H19M0 -19V19" /></g>
        </g>
        <g filter="url(#pd-rough4)" opacity="0.5">
          <rect x="915" y="250" width="120" height="30" fill="var(--papel-tinta, #F1E6DE)" transform="rotate(-8 975 265)" />
        </g>
      </svg>
      <DepthScene />
    </div>
  );
}
