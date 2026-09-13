import Explore from '../../components/Explore';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Explorar carretes en Valpo y Viña',
  alternates: { canonical: '/buscar' },
  robots: { index: false, follow: true },
};
export default async function Search({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <Explore params={await searchParams} />;
}
