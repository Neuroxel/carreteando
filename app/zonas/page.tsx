import Link from 'next/link';
import { getPublicEvents } from '../../lib/server-events';
import { getPublicVenues } from '../../lib/server-venues';
import { zonaSlug, zonasDe } from '../../lib/venues';
import { CIUDADES } from '../../lib/types';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Carretes por zona',
  description:
    'Zonas reales de la Región de Valparaíso: cuántos lugares hay, qué se viene y cómo llegar.',
  alternates: { canonical: '/zonas' },
};
export default async function Zones() {
  const [result, venues] = await Promise.all([getPublicEvents(), getPublicVenues()]);
  const zonas = zonasDe(venues.lugares);
  const eventosDe = (nombres: Set<string>) =>
    result.events.filter((e) => e.lugar && nombres.has(e.lugar));
  return (
    <section className="container page-section">
      <p className="eyebrow">UN PLAN CERCA</p>
      <h1>
        De cerro
        <br />
        <em>a costa.</em>
      </h1>
      <p className="lead">
        Las zonas agrupan lugares reales, no sólo comunas. Cada una muestra cuántos sitios tenemos
        revisados y qué hay anunciado.
      </p>
      {(result.status === 'error' || venues.status === 'error') && (
        <p role="alert" className="form-error">
          No pudimos consultar la disponibilidad. Intenta más tarde.
        </p>
      )}
      <h2>
        Barrios y sectores
        <span className="heading-period">.</span>
      </h2>
      <div className="zone-grid">
        {zonas.map((z) => {
          const nombres = new Set(z.lugares.map((l) => l.nombre));
          const eventos = eventosDe(nombres);
          return (
            <Link className="zone-card" key={z.zona} href={`/zonas/${zonaSlug(z.zona)}`}>
              <span className="eyebrow">{z.ciudad.toUpperCase()}</span>
              <h3>{z.zona}</h3>
              <p className="zone-preview">
                {z.lugares
                  .slice(0, 3)
                  .map((l) => l.nombre)
                  .join(' · ')}
              </p>
              <span>
                {z.lugares.length} {z.lugares.length === 1 ? 'lugar' : 'lugares'} ·{' '}
                {eventos.length} {eventos.length === 1 ? 'fecha' : 'fechas'}{' '}
                <span aria-hidden="true">↗</span>
              </span>
            </Link>
          );
        })}
      </div>
      <h2>
        Por comuna
        <span className="heading-period">.</span>
      </h2>
      <div className="zone-grid">
        {CIUDADES.map((c) => {
          const lugares = venues.lugares.filter((l) => l.ciudad === c);
          const eventos = result.events.filter((e) => e.ciudad === c);
          return (
            <Link className="zone-card" key={c} href={`/buscar?ciudad=${encodeURIComponent(c)}`}>
              <span className="eyebrow">V REGIÓN</span>
              <h3>{c}</h3>
              <p className="zone-preview">
                {eventos
                  .slice(0, 2)
                  .map((e) => `${e.fecha.slice(8)}/${e.fecha.slice(5, 7)} · ${e.nombre}`)
                  .join(' / ') ||
                  (lugares.length
                    ? `${lugares.length} ${lugares.length === 1 ? 'lugar revisado' : 'lugares revisados'}, sin fechas anunciadas.`
                    : 'Aún no tenemos nada revisado aquí. Puedes proponerlo con su fuente.')}
              </p>
              <span>
                {eventos.length} {eventos.length === 1 ? 'plan' : 'planes'} · {lugares.length}{' '}
                {lugares.length === 1 ? 'lugar' : 'lugares'} <span aria-hidden="true">↗</span>
              </span>
            </Link>
          );
        })}
      </div>
      <p className="trust-note">
        Que una comuna aparezca vacía significa que todavía no tenemos una fuente revisada ahí, no
        que no exista vida nocturna.
      </p>
    </section>
  );
}
