import Link from 'next/link';
import { getPublicEvents } from '../../lib/server-events';
import { CIUDADES } from '../../lib/types';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Carretes por zona', alternates: { canonical: '/zonas' } };
export default async function Zones() {
  const result = await getPublicEvents();
  return (
    <section className="container page-section">
      <p className="eyebrow">UN PLAN CERCA</p>
      <h1>
        De cerro
        <br />
        <em>a costa.</em>
      </h1>
      <p className="lead">
        Elige tu zona para ver eventos vigentes. Las indicaciones para llegar están en cada evento
        cuando conocemos el lugar.
      </p>
      {result.status === 'error' && (
        <p role="alert" className="form-error">
          No pudimos consultar la disponibilidad. Intenta más tarde.
        </p>
      )}
      <div className="zone-grid">
        {CIUDADES.map((c, i) => (
          <Link className="zone-card" key={c} href={`/buscar?ciudad=${encodeURIComponent(c)}`}>
            <span className="eyebrow">0{i + 1} / V REGIÓN</span>
            <h2>{c}</h2>
            <span>
              {result.status === 'ok'
                ? `${result.events.filter((e) => e.ciudad === c).length} planes en cartelera`
                : 'Consultar cartelera'}{' '}
              <span aria-hidden="true">↗</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
