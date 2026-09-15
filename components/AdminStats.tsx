import { getChileTodayStr } from '../lib/events';
type Fila = Record<string, unknown>;
const pct = (n: number, total: number) => (total ? Math.round((n * 100) / total) : 0);
function Barra({ label, n, total }: { label: string; n: number; total: number }) {
  const p = pct(n, total);
  return (
    <li>
      <span className="stat-etiqueta">{label}</span>
      <span className="stat-barra" aria-hidden="true">
        <span style={{ width: `${p}%` }} />
      </span>
      <span className="stat-cifra">
        {n}/{total} · {p}%
      </span>
    </li>
  );
}
function Grupo({ titulo, filas }: { titulo: string; filas: [string, number][] }) {
  const total = filas.reduce((n, [, v]) => n + v, 0);
  if (!total) return null;
  return (
    <div className="stat-grupo">
      <h4>{titulo}</h4>
      <ul className="stat-lista">
        {filas
          .filter(([, v]) => v > 0)
          .sort((a, b) => b[1] - a[1])
          .map(([k, v]) => (
            <li key={k}>
              <span className="stat-etiqueta">{k}</span>
              <span className="stat-barra" aria-hidden="true">
                <span style={{ width: `${pct(v, Math.max(...filas.map((f) => f[1])))}%` }} />
              </span>
              <span className="stat-cifra">{v}</span>
            </li>
          ))}
      </ul>
    </div>
  );
}
function cuenta(filas: Fila[], campo: string) {
  const m = new Map<string, number>();
  for (const f of filas) {
    const v = f[campo];
    const k = typeof v === 'string' && v ? v : 'sin dato';
    m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m.entries()] as [string, number][];
}
/**
 * La cobertura es de lo que conocemos, no de toda la noche de la región. Eso no
 * se puede demostrar, así que no se afirma en ninguna parte de este panel.
 */
export default function AdminStats({
  venues,
  events,
  sources,
  metrics,
}: {
  venues: Fila[];
  events: Fila[];
  sources: Fila[];
  metrics: Fila[];
}) {
  const hoy = getChileTodayStr();
  const manana = new Date(Date.parse(`${hoy}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);
  const en7 = new Date(Date.parse(`${hoy}T12:00:00Z`) + 7 * 86400000).toISOString().slice(0, 10);
  const publicados = venues.filter((v) => v.disposition === 'published');
  const total = publicados.length;
  const conEvidencia = venues.filter((v) => v.disposition === 'needs_evidence');
  const cerrados = venues.filter((v) => v.disposition === 'closed');
  const sinDisposicion = venues.filter((v) => !v.disposition);
  const vigentes = events.filter((e) => typeof e.date_text === 'string' && e.date_text >= hoy && e.is_active);
  const con = (campo: string) => publicados.filter((v) => v[campo] !== null && v[campo] !== undefined).length;
  const conIdentidad = publicados.filter(
    (v) => v.instagram_url || v.official_url || v.facebook_url || v.tiktok_url || v.contact_url,
  ).length;
  const fuentesOk = sources.filter((s) => Number(s.consecutive_failures || 0) === 0 && s.last_success_at).length;
  const fuentesMal = sources.filter((s) => Number(s.consecutive_failures || 0) >= 3).length;
  const fuentesSinResultado = sources.filter(
    (s) => s.last_success_at && Number(s.unique_event_count || 0) === 0,
  ).length;
  const eventoPorFecha = (desde: string, hasta: string) =>
    vigentes.filter((e) => String(e.date_text) >= desde && String(e.date_text) <= hasta).length;
  const acciones = new Map<string, number>();
  for (const m of metrics) {
    const n = String(m.name || '');
    acciones.set(n, (acciones.get(n) || 0) + Number(m.count || 0));
  }
  return (
    <div className="stats-panel">
      <div className="stat-tarjetas">
        <div>
          <strong>{total}</strong>
          <span>lugares públicos</span>
        </div>
        <div>
          <strong>{vigentes.length}</strong>
          <span>eventos vigentes</span>
        </div>
        <div>
          <strong>{eventoPorFecha(hoy, hoy)}</strong>
          <span>para hoy</span>
        </div>
        <div>
          <strong>{conEvidencia.length}</strong>
          <span>esperando evidencia</span>
        </div>
        <div className={sinDisposicion.length ? 'stat-alerta' : ''}>
          <strong>{sinDisposicion.length}</strong>
          <span>sin clasificar</span>
        </div>
      </div>
      <h3>Qué tan completo está cada lugar público</h3>
      <ul className="stat-lista">
        <Barra label="Dirección" n={con('address')} total={total} />
        <Barra label="Coordenada verificada" n={con('latitude')} total={total} />
        <Barra label="Zona" n={con('zone')} total={total} />
        <Barra label="Alguna identidad digital" n={conIdentidad} total={total} />
        <Barra label="Instagram" n={con('instagram_url')} total={total} />
        <Barra label="Sitio propio" n={con('official_url')} total={total} />
        <Barra label="Facebook" n={con('facebook_url')} total={total} />
        <Barra label="TikTok" n={con('tiktok_url')} total={total} />
        <Barra label="Contacto público" n={con('contact_url')} total={total} />
        <Barra label="Imagen propia" n={con('image_url')} total={total} />
        <Barra label="Fuente de programación" n={con('primary_programming_source')} total={total} />
      </ul>
      <h3>Agenda</h3>
      <ul className="stat-lista">
        <Barra label="Hoy" n={eventoPorFecha(hoy, hoy)} total={vigentes.length} />
        <Barra label="Mañana" n={eventoPorFecha(manana, manana)} total={vigentes.length} />
        <Barra label="Próximos 7 días" n={eventoPorFecha(hoy, en7)} total={vigentes.length} />
        <Barra
          label="Fondas del 17 al 20"
          n={vigentes.filter((e) => e.event_type === 'fonda' && String(e.date_text) >= '2026-09-17' && String(e.date_text) <= '2026-09-20').length}
          total={vigentes.length}
        />
      </ul>
      <div className="stat-columnas">
        <Grupo titulo="Lugares por comuna" filas={cuenta(publicados, 'city')} />
        <Grupo titulo="Lugares por tipo" filas={cuenta(publicados, 'venue_type')} />
        <Grupo titulo="Eventos por comuna" filas={cuenta(vigentes, 'city')} />
        <Grupo titulo="Eventos por origen" filas={cuenta(vigentes, 'source')} />
        <Grupo titulo="Evidencia pendiente por comuna" filas={cuenta(conEvidencia, 'city')} />
        <Grupo
          titulo="Uso del sitio (acumulado)"
          filas={[...acciones.entries()].filter(([k]) => !k.startsWith('ingesta'))}
        />
      </div>
      <h3>Automatización</h3>
      <ul className="stat-lista">
        <Barra label="Fuentes que respondieron bien" n={fuentesOk} total={sources.length} />
        <Barra label="Fuentes caídas" n={fuentesMal} total={sources.length} />
        <Barra label="Fuentes sin resultados" n={fuentesSinResultado} total={sources.length} />
        <Barra
          label="Eventos de adaptador vigentes"
          n={vigentes.filter((e) => e.source === 'adapter').length}
          total={vigentes.length}
        />
      </ul>
      <p className="trust-note">
        Esto mide lo que conocemos, no toda la noche de la región: no hay forma de demostrar que
        exista un catastro completo. {cerrados.length} lugares están marcados como cerrados y no
        aparecen en el sitio.
      </p>
    </div>
  );
}
