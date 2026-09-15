import { permanentRedirect } from 'next/navigation';
export default async function Lugares({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams({ ver: 'lugares' });
  if (typeof params.tipo === 'string') query.set('tipo', params.tipo);
  if (params.vista === 'mapa') query.set('vista', 'mapa');
  permanentRedirect(`/explorar?${query.toString()}`);
}
