/**
 * Pictogramas propios del onboarding (trazo de serigrafía, 32×32, color del
 * texto). Reemplazan emojis: misma familia visual, se leen a la distancia.
 */
const TRAZOS: Record<string, string> = {
  // Bola disco
  bailar: 'M16 4a10 10 0 1 0 0 20a10 10 0 1 0 0-20M6 14h20M7.5 9h17M7.5 19h17M16 4c-4 4-4 16 0 20M16 4c4 4 4 16 0 20M16 24v4',
  // Schop con espuma
  'tomar-algo': 'M8 10h13v16a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2zM21 13h3a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-3M8 10c0-3 2-5 4-4c1-2 4-2 5 0c2-1 5 0 4 4M12 15v9M17 15v9',
  // Guitarra
  'musica-en-vivo': 'M19 13l7-7M24 4l4 4M19 13a6 6 0 0 0-8-1a5 5 0 0 1-5 4a5 5 0 0 0 0 7l2 2a5 5 0 0 0 7 0a5 5 0 0 1 4-5a6 6 0 0 0 0-7zM12 20a2 2 0 1 0 0.1 0',
  // Micrófono
  karaoke: 'M13 5a5 5 0 0 1 9 4l-6 6a5 5 0 0 1-4-9zM13 13l-7 9l3 3l9-7M19 6l6 6',
  // Boca riendo
  comedia: 'M16 4a12 12 0 1 0 0 24a12 12 0 1 0 0-24M10 12h3M19 12h3M9 17h14a7 7 0 0 1-14 0z',
  // Luna
  tranqui: 'M22 22A10 10 0 0 1 12 6a10 10 0 1 0 10 16zM24 6v4M22 8h4',
  // Destello
  sorprendeme: 'M16 3l2.5 8.5L27 14l-8.5 2.5L16 25l-2.5-8.5L5 14l8.5-2.5zM26 23l1 3l3 1l-3 1l-1 3l-1-3l-3-1l3-1z',
  // Pin con ondas de radar
  cerca: 'M16 28s8-7 8-14a8 8 0 0 0-16 0c0 7 8 14 8 14zM16 11a3 3 0 1 0 0.1 0',
};
export default function Pictograma({ id, className }: { id: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" width="32" height="32" aria-hidden="true" focusable="false">
      <path d={TRAZOS[id] || TRAZOS.sorprendeme} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
