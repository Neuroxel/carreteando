import type { Metadata } from 'next';
import ExploreClient from '../components/ExploreClient';
import { getPublicSnapshot } from '../lib/snapshot';
// Estática y cacheada: se regenera como mucho cada 5 minutos o cuando la
// ingesta o la moderación cambian algo. Filtrar ocurre en el teléfono.
export const revalidate = 300;
export const metadata: Metadata = { alternates: { canonical: '/' } };
export default async function Home() {
  return <ExploreClient snapshot={await getPublicSnapshot()} home />;
}
