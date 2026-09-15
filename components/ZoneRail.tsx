import Link from 'next/link';
import { normalizar } from '../lib/map';
import { acentoDe } from '../lib/types';
import type { Evento } from '../lib/types';
import { zonaSlug, zonasDe, type Lugar } from '../lib/venues';
/**
 * A night in Valparaíso is a walk, not a list: you start on one hill and end up
 * on the next. The rail says which stretches are alive tonight and how far they
 * are from each other, which a grid of cards never does.
 */
export default function ZoneRail({
  lugares,
  eventos,
  hoy,
}: {
  lugares: Lugar[];
  eventos: Evento[];
  hoy: string;
}) {
  const zonaDeLugar = new Map<string, string>();
  for (const l of lugares) if (l.zona) zonaDeLugar.set(normalizar(l.nombre), l.zona);
  const hoyPorZona = new Map<string, number>();
  for (const e of eventos) {
    if (e.fecha !== hoy || !e.lugar) continue;
    const zona = zonaDeLugar.get(normalizar(e.lugar));
    if (zona) hoyPorZona.set(zona, (hoyPorZona.get(zona) || 0) + 1);
  }
  const zonas = zonasDe(lugares).slice(0, 12);
  if (zonas.length < 3) return null;
  const activas = zonas.filter((z) => hoyPorZona.get(z.zona));
  return (
    <section className="container zone-rail-block" aria-labelledby="ruta-titulo">
      <div className="section-heading">
        <h2 id="ruta-titulo">
          De un lugar
          <span className="heading-period"> al siguiente.</span>
        </h2>
        <span className="result-count">
          {activas.length ? `${activas.length} zonas con algo hoy` : `${zonas.length} zonas`}
        </span>
      </div>
      <ul className="zone-rail" aria-label="Zonas de la región">
        {zonas.map((z, i) => {
          const hoyAqui = hoyPorZona.get(z.zona) || 0;
          return (
            <li key={z.zona} className="reveal" style={{ ['--i' as string]: String(i) }}>
              <Link
                href={`/zonas/${zonaSlug(z.zona)}`}
                className={`zone-stop ${hoyAqui ? 'zone-stop-viva' : ''}`}
                style={{ ['--acento' as string]: acentoDe(z.ciudad) }}
              >
                <span className="zone-dot" aria-hidden="true" />
                <span className="zone-name">{z.zona}</span>
                <span className="zone-meta">
                  {z.ciudad} · {z.lugares.length} {z.lugares.length === 1 ? 'lugar' : 'lugares'}
                </span>
                {hoyAqui > 0 && (
                  <span className="zone-hoy">
                    {hoyAqui} {hoyAqui === 1 ? 'fecha hoy' : 'fechas hoy'}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="zone-rail-pie">
        <Link href="/zonas">Ver todas las zonas</Link>
        <Link href="/lugares?vista=mapa">Verlas en el mapa</Link>
      </p>
    </section>
  );
}
