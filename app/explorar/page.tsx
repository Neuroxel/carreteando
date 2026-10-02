import type { Metadata } from 'next';
import Explore from '../../components/Explore';
import { filterRobots } from '../../lib/filter-seo';
export const dynamic = 'force-dynamic';
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  return {
    title: 'Explorar la noche en la Región de Valparaíso',
    description:
      'Eventos y lugares para salir en Valpo, Viña y alrededores. Filtra por noche, comuna, estilo y precio, en lista o en el mapa.',
    alternates: { canonical: '/explorar' },
    ...filterRobots(await searchParams),
  };
}
export default async function Explorar({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <Explore params={await searchParams} />;
}
