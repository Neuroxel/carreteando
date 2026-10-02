import type { Metadata } from 'next';
import Explore from '../components/Explore';
import { filterRobots } from '../lib/filter-seo';
export const dynamic = 'force-dynamic';
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  return { alternates: { canonical: '/' }, ...filterRobots(await searchParams) };
}
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <Explore home params={await searchParams} />;
}
