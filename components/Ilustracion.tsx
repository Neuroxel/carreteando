/**
 * Ilustraciones de los afiches en puntillismo, como el spray y la luna del
 * sitio: formas rellenas con tramas de puntos (densa = sombra, suave = luz),
 * contorno de tinta y rayos de grabado detrás. SVG puro, pocos KB, sin imágenes.
 */
const RAYOS = Array.from({ length: 14 }, (_, i) => {
  const a = (i / 14) * Math.PI * 2;
  const r1 = 34;
  const r2 = i % 2 ? 44 : 48;
  return `M${(60 + Math.cos(a) * r1).toFixed(1)} ${(50 + Math.sin(a) * r1).toFixed(1)}L${(60 + Math.cos(a) * r2).toFixed(1)} ${(50 + Math.sin(a) * r2).toFixed(1)}`;
}).join('');

function Tramas({ id }: { id: string }) {
  return (
    <defs>
      <pattern id={`${id}-densa`} width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
        <circle cx="1" cy="1" r=".9" fill="currentColor" />
      </pattern>
      <pattern id={`${id}-media`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(15)">
        <circle cx="1" cy="1" r=".8" fill="currentColor" />
        <circle cx="3" cy="3" r=".5" fill="currentColor" />
      </pattern>
      <pattern id={`${id}-suave`} width="5" height="5" patternUnits="userSpaceOnUse">
        <circle cx="1.5" cy="1.5" r=".6" fill="currentColor" />
      </pattern>
    </defs>
  );
}

const DIBUJOS: Record<string, (id: string) => React.ReactNode> = {
  bailar: (id) => (
    <>
      <path d="M60 4V20" />
      <circle cx="60" cy="50" r="28" fill={`url(#${id}-media)`} />
      <path d="M60 22a28 28 0 0 1 0 56M60 22a28 28 0 0 0 0 56" fill={`url(#${id}-densa)`} opacity=".55" />
      <circle cx="60" cy="50" r="28" />
      <path d="M32 50h56M35 37h50M35 63h50M41 27h38M41 73h38M60 22c-12 8-12 48 0 56M60 22c12 8 12 48 0 56M60 22c-22 10-22 46 0 56M60 22c22 10 22 46 0 56" />
      <circle cx="50" cy="40" r="5" fill="var(--crema, #EFE3D3)" stroke="none" />
    </>
  ),
  'tomar-algo': (id) => (
    <>
      <path d="M40 30h40l-5 62H45z" fill={`url(#${id}-densa)`} />
      <path d="M44 46h32l-3 40H47z" fill={`url(#${id}-suave)`} stroke="none" opacity=".9" />
      <path d="M40 30h40l-5 62H45z" />
      <path d="M38 30c-4-10 6-16 12-12c2-8 14-8 16 0c6-6 16 0 14 12z" fill="var(--crema, #EFE3D3)" />
      <path d="M45 30c1 4 4 6 7 5M60 31c1 3 4 5 7 4" />
      <path d="M50 54v28M58 52v30M66 54v28" opacity=".5" />
    </>
  ),
  'musica-en-vivo': (id) => (
    <>
      <path d="M70 34l26-26M92 4l8 8l-6 6l-8-8z" />
      <path d="M64 38c8 6 8 16 2 22c-2 6 4 14-4 22c-9 9-24 9-32 1c-8-8-8-23 1-32c8-8 16-2 22-4c6-6 5-15 11-9z" fill={`url(#${id}-densa)`} />
      <path d="M64 38c8 6 8 16 2 22c-2 6 4 14-4 22c-9 9-24 9-32 1c-8-8-8-23 1-32c8-8 16-2 22-4c6-6 5-15 11-9z" />
      <circle cx="47" cy="66" r="6" fill="var(--crema, #EFE3D3)" />
      <path d="M41 74l26-26M38 70l6 6M60 52l6 6" />
    </>
  ),
  karaoke: (id) => (
    <>
      <rect x="47" y="8" width="26" height="38" rx="13" fill={`url(#${id}-densa)`} />
      <rect x="47" y="8" width="26" height="38" rx="13" />
      <path d="M47 22h26M47 30h26M60 8v38" opacity=".5" />
      <path d="M40 34c0 14 9 22 20 22s20-8 20-22M60 56v20M46 92l14-16l14 16M60 76v16" />
    </>
  ),
  comedia: (id) => DIBUJOS.karaoke(id),
  tranqui: (id) => (
    <>
      <path d="M22 18v72M98 18v72M22 36c18 30 58 30 76 0" />
      <path d="M22 36c18 30 58 30 76 0c-18 16-58 16-76 0z" fill={`url(#${id}-densa)`} />
      <path d="M30 40l4 10M40 46l3 10M52 49l2 10M64 49l-1 10M76 46l-3 10M88 40l-4 10" opacity=".6" />
      <path d="M70 10a9 9 0 1 0 9 12a7 7 0 1 1-9-12z" fill={`url(#${id}-media)`} />
      <path d="M44 10l1.5 3 3 1.5-3 1.5L44 19l-1.5-3-3-1.5 3-1.5zM56 20l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" />
    </>
  ),
  sorprendeme: (id) => (
    <>
      <circle cx="60" cy="50" r="22" fill={`url(#${id}-media)`} />
      <path d="M60 28a22 22 0 0 1 0 44" fill={`url(#${id}-densa)`} stroke="none" />
      <circle cx="60" cy="50" r="22" />
      <ellipse cx="60" cy="52" rx="44" ry="11" transform="rotate(-14 60 52)" />
      <path d="M26 30l2 5 5 2-5 2-2 5-2-5-5-2 5-2zM96 74l1.5 3.5 3.5 1.5-3.5 1.5L96 84l-1.5-3.5-3.5-1.5 3.5-1.5z" />
    </>
  ),
};

export default function Ilustracion({ id, className }: { id: string; className?: string }) {
  const dibujo = DIBUJOS[id] || DIBUJOS.sorprendeme;
  const uid = `il-${id}`;
  return (
    <svg className={className} viewBox="0 0 120 100" aria-hidden="true" focusable="false">
      <Tramas id={uid} />
      <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d={RAYOS} strokeWidth="1" opacity=".55" />
        {dibujo(uid)}
      </g>
    </svg>
  );
}
