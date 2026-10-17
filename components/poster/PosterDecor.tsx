import Profundidad from './Profundidad';
/**
 * El arte del hero, como en la maqueta de Carlos: una nube de spray violeta,
 * una luna punteada y un spray coral al borde, sobre papel negro (el grano lo
 * pone el CSS). Son imágenes chicas y fijas: sin JavaScript se ve igual.
 *
 * Si el teléfono entrega inclinación real, Profundidad corre cada capa unos px
 * (`data-amp`): fondo 6, luna 11, spray cercano 16. La interfaz no se mueve.
 */
export default function PosterDecor({ variant }: { variant: 'home' | 'small' }) {
  return (
    <div className={`poster-decor poster-${variant}`} aria-hidden="true">
      <div className="pd-capa pd-nube-violeta" data-amp="6" />
      <div className="pd-capa pd-luna" data-amp="11" />
      <div className="pd-capa pd-nube-coral" data-amp="16" />
      <Profundidad />
    </div>
  );
}
