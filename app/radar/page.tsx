import { permanentRedirect } from 'next/navigation';
/** /radar es el mapa: abre Radar y, como es un gesto explícito, pide la ubicación. */
export default function Radar() {
  permanentRedirect('/?vista=mapa&ubicar=1');
}
