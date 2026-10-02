import type { Metadata } from 'next';
import ExploreClient from '../../components/ExploreClient';
import { getPublicSnapshot } from '../../lib/snapshot';
export const revalidate = 300;
export const metadata: Metadata = {
  title: 'Explorar la noche en la Región de Valparaíso',
  description:
    'Eventos y lugares para salir en Valpo, Viña y alrededores. Filtra por noche, comuna, escena y precio, en lista o en el mapa.',
  // Las variantes con filtros (?ciudad=…) apuntan a esta URL limpia.
  alternates: { canonical: '/explorar' },
};
export default async function Explorar() {
  return <ExploreClient snapshot={await getPublicSnapshot()} />;
}
