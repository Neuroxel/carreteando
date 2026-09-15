import Explore from '../../components/Explore';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Explorar la noche en la Región de Valparaíso',
  description:
    'Eventos y lugares para salir en Valpo, Viña y alrededores. Filtra por noche, comuna, estilo y precio, en lista o en el mapa.',
  alternates: { canonical: '/explorar' },
};
export default async function Explorar({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <Explore params={await searchParams} />;
}
