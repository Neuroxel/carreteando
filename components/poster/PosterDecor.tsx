import { Q } from '../Logo';
import DepthScene from './DepthScene';
/**
 * El "mundo" detrás del hero, como un afiche impreso: trama de puntos, un halo
 * y un túnel de "?" corridos como capas de tinta. Es SVG estático renderizado en
 * el servidor: sin JavaScript ni WebGL el sitio se ve así, completo. Si el
 * equipo lo permite, DepthScene usa estas mismas capas como texturas de Three.js
 * y les da profundidad. Nada de esto recibe toques ni lleva información: cada capa
 * es aria-hidden; solo el botón opcional del sensor es un control real.
 */
const RINGS = [
  { s: 0.6, cx: 772, cy: 344, color: 'var(--papel-tinta, #F1E6DE)', o: 0.85, w: 14 },
  { s: 0.6, cx: 779, cy: 349, color: 'var(--accent)', o: 0.75, w: 14 },
  { s: 0.47, cx: 790, cy: 322, color: 'var(--accent-2)', o: 0.55, w: 16 },
  { s: 0.36, cx: 805, cy: 304, color: 'var(--accent)', o: 0.4, w: 20 },
  { s: 0.27, cx: 818, cy: 290, color: 'var(--accent-2)', o: 0.3, w: 24 },
  { s: 0.2, cx: 829, cy: 280, color: 'var(--lila, #B9A3DA)', o: 0.22, w: 30 },
];
// El "?" de Archivo Black mide ~611 × 700 unidades y apoya en y = 0.
const ring = (r: (typeof RINGS)[number]) =>
  `translate(${r.cx - (611 * r.s) / 2} ${r.cy + (700 * r.s) / 2}) scale(${r.s}) rotate(-6 305 -350)`;

export default function PosterDecor({ variant }: { variant: 'home' | 'small' }) {
  return (
    <div className={`poster-decor poster-${variant}`}>
      <svg className="pd-layer" aria-hidden="true" data-depth="0" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id="pd-dots" width="9" height="9" patternUnits="userSpaceOnUse">
            <circle cx="4.5" cy="4.5" r="2.2" fill="var(--accent-2)" />
          </pattern>
          <radialGradient id="pd-fade">
            <stop offset="0" stopColor="#fff" stopOpacity="1" />
            <stop offset="0.6" stopColor="#fff" stopOpacity="0.55" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <mask id="pd-m1"><ellipse cx="170" cy="560" rx="430" ry="230" fill="url(#pd-fade)" /></mask>
          <mask id="pd-m2"><ellipse cx="900" cy="40" rx="300" ry="150" fill="url(#pd-fade)" /></mask>
          <filter id="pd-rough" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7" />
            <feDisplacementMap in="SourceGraphic" scale="22" />
          </filter>
        </defs>
        <g filter="url(#pd-rough)">
          <rect width="1000" height="600" fill="url(#pd-dots)" mask="url(#pd-m1)" opacity="0.42" />
          <rect width="1000" height="600" fill="url(#pd-dots)" mask="url(#pd-m2)" opacity="0.28" />
        </g>
      </svg>
      <svg className="pd-layer" aria-hidden="true" data-depth="1" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="pd-halo">
            <stop offset="0" stopColor="var(--lila, #B9A3DA)" stopOpacity="0.34" />
            <stop offset="1" stopColor="var(--lila, #B9A3DA)" stopOpacity="0" />
          </radialGradient>
          <pattern id="pd-dots2" width="14" height="14" patternUnits="userSpaceOnUse">
            <circle cx="7" cy="7" r="3.1" fill="var(--lila, #B9A3DA)" />
          </pattern>
          <radialGradient id="pd-fade2">
            <stop offset="0" stopColor="#fff" stopOpacity="1" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <mask id="pd-m3"><ellipse cx="690" cy="470" rx="190" ry="90" fill="url(#pd-fade2)" /></mask>
        </defs>
        <circle cx="800" cy="300" r="270" fill="url(#pd-halo)" />
        <rect width="1000" height="600" fill="url(#pd-dots2)" mask="url(#pd-m3)" opacity="0.22" />
      </svg>
      <svg className="pd-layer" aria-hidden="true" data-depth="2" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice">
        {RINGS.map((r, i) => (
          <g key={i} data-ring={i} transform={ring(r)} opacity={r.o}>
            <path d={Q} fill="none" stroke={r.color} strokeWidth={r.w} strokeLinejoin="round" />
          </g>
        ))}
      </svg>
      <DepthScene />
    </div>
  );
}
