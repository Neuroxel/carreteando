import DepthScene from './DepthScene';
import { ciudadRegional } from './ciudad';
/**
 * El "mundo" detrás del hero: un collage serigráfico de la ciudad en capas.
 * Es SVG estático renderizado en el servidor: sin JavaScript ni WebGL el sitio
 * se ve así, completo. Si el equipo lo permite, DepthScene toma cada capa con
 * `data-amp` como un plano propio y lo mueve según su profundidad:
 * `data-amp` = desplazamiento máximo en px, `data-z` = profundidad del plano.
 *
 *   Z0 papel y tinta honda ......  4 px (con deriva "líquida" muy leve)
 *   Z1 cerros lejanos ...........  8 px
 *   Z2 cerro con casas y ascensor  17 px
 *   Z3 edificios traslúcidos .... 30 px (ventanas caladas: se ve lo de atrás)
 *   Z4 cables, aves, marcas ..... 42 px
 *   Interfaz (DOM) ..............  0 px
 *
 * Sin filtros SVG en capas grandes: el borde "cortado a mano" viene del trazado
 * y la textura de papel la pone el CSS encima. Nada referencia archivos
 * externos (la escena rasteriza estos SVG como imagen, sin red).
 */
const C = ciudadRegional();
const TINTA = '#0D0D16';
const INDIGO = '#23253C';
const VIOLETA = '#5A4E7C';
const LILA = '#8C7AB8';
const CORAL = '#E0607A';
const CREMA = '#E9DCCF';

export default function PosterDecor({ variant }: { variant: 'home' | 'small' }) {
  const vista = { viewBox: '0 0 1000 600', preserveAspectRatio: 'xMidYMin slice' } as const;
  return (
    <div className={`poster-decor poster-${variant}`}>
      {/* Z0 · tinta honda: tramas y la luna en semitono */}
      <svg className="pd-layer" data-amp="4" data-z="-2.8" data-liquid="1" aria-hidden="true" {...vista}>
        <defs>
          <pattern id="pd-dots" width="9" height="9" patternUnits="userSpaceOnUse">
            <circle cx="4.5" cy="4.5" r="2.4" fill={LILA} />
          </pattern>
          <pattern id="pd-luna" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(15)">
            <circle cx="3.5" cy="3.5" r="2.6" fill={CREMA} />
          </pattern>
          <radialGradient id="pd-fade">
            <stop offset="0" stopColor="#fff" stopOpacity="1" />
            <stop offset="0.6" stopColor="#fff" stopOpacity="0.5" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <mask id="pd-m1">
            <ellipse cx="150" cy="420" rx="420" ry="200" fill="url(#pd-fade)" />
          </mask>
          <mask id="pd-m2">
            <ellipse cx="880" cy="40" rx="300" ry="150" fill="url(#pd-fade)" />
          </mask>
        </defs>
        <rect width="1000" height="600" fill="url(#pd-dots)" mask="url(#pd-m1)" opacity="0.35" />
        <rect width="1000" height="600" fill="url(#pd-dots)" mask="url(#pd-m2)" opacity="0.3" />
        <circle cx="742" cy="118" r="64" fill="url(#pd-luna)" opacity="0.5" />
        <circle cx="736" cy="114" r="64" fill="none" stroke={CORAL} strokeWidth="2" opacity="0.45" />
      </svg>

      {/* Z1 · cerros lejanos, luces y torres de la costa */}
      <svg className="pd-layer" data-amp="8" data-z="-2" aria-hidden="true" {...vista}>
        <path d={C.lejos1} fill="#1C1D30" />
        <path d={C.torresLejos} fill="#2B2D4A" />
        <path d={C.lejos2} fill={INDIGO} />
        <path d={C.lucesLejos} fill={CREMA} opacity="0.45" />
      </svg>

      {/* Z2 · cerro con casas apiladas, ascensor e iglesia */}
      <svg className="pd-layer" data-amp="17" data-z="-1" aria-hidden="true" {...vista}>
        <path d={C.cerroMedio} fill="#2F2A47" />
        <path d={C.iglesia} fill={VIOLETA} />
        <path d={C.casas.violeta} fill={VIOLETA} />
        <path d={C.casas.lila} fill={LILA} opacity="0.8" />
        <path d={C.casas.coral} fill={CORAL} opacity="0.62" />
        <path d={C.casas.crema} fill={CREMA} opacity="0.55" />
        <path d={C.ventanas} fill={TINTA} opacity="0.85" />
        <path d={C.ascensor.riel} stroke={TINTA} strokeWidth="3" fill="none" />
        <path d={C.ascensor.estaciones} fill={CREMA} opacity="0.7" />
        <path d={C.ascensor.carro} fill={CORAL} />
      </svg>

      {/* Z3 · edificios cercanos traslúcidos: trama + ventanas caladas */}
      <svg className="pd-layer pd-cerca" data-amp="30" data-z="0.4" aria-hidden="true" {...vista}>
        <defs>
          <pattern id="pd-trama-coral" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
            <circle cx="3" cy="3" r="1.9" fill={CORAL} />
          </pattern>
          <pattern id="pd-trama-crema" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-20)">
            <circle cx="3" cy="3" r="1.6" fill={CREMA} />
          </pattern>
        </defs>
        {C.cerca.map((e, i) => {
          const d = e.contorno + e.huecos;
          const trama = i % 2 ? 'url(#pd-trama-coral)' : 'url(#pd-trama-crema)';
          return (
            <g key={i}>
              {/* tinta plana traslúcida + semitono encima, todo con las ventanas caladas */}
              <path d={d} fillRule="evenodd" fill={i % 2 ? CORAL : CREMA} opacity="0.13" />
              <path d={d} fillRule="evenodd" fill={trama} opacity={i % 2 ? 0.5 : 0.32} />
              <path d={d} fillRule="evenodd" fill="none" stroke={TINTA} strokeWidth="2.6" opacity="0.9" />
            </g>
          );
        })}
      </svg>

      {/* Z4 · imprenta al frente: cables, aves, poste, marcas de registro, cinta */}
      <svg className="pd-layer pd-front" data-amp="42" data-z="1.2" aria-hidden="true" {...vista}>
        {C.cables.map((d, i) => (
          <path key={i} d={d} stroke={TINTA} strokeWidth={2.4 - i * 0.3} fill="none" />
        ))}
        <path d={C.aves} fill={TINTA} />
        <path d={C.poste} fill={TINTA} />
        <g stroke={CREMA} strokeWidth="2" opacity="0.55" fill="none">
          <g transform="translate(968 34)">
            <circle r="11" />
            <path d="M-19 0H19M0 -19V19" />
          </g>
          <g transform="translate(32 566)">
            <circle r="11" />
            <path d="M-19 0H19M0 -19V19" />
          </g>
        </g>
        <rect x="560" y="22" width="110" height="26" fill={CREMA} opacity="0.5" transform="rotate(-7 615 35)" />
      </svg>
      <DepthScene />
    </div>
  );
}
