import { permanentRedirect } from 'next/navigation';
export default async function Buscar({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (typeof v === 'string') query.set(k, v);
  const cadena = query.toString();
  permanentRedirect(cadena ? `/explorar?${cadena}` : '/explorar');
}
