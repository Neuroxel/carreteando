type Fila = Record<string, unknown>;
const pct = (n: number, total: number) => (total ? Math.round((n * 100) / total) : 0);
const NOMBRES: Record<string, string> = {
  AUTO_PUBLISH: 'Publicado solo',
  AUTO_PROMOTE_FROM_REVIEW: 'Promovido desde la cola',
  AUTO_REJECT: 'Descartado solo',
  AUTO_EXPIRE: 'Vencido solo',
  AUTO_CANCEL: 'Cancelado solo',
  REVIEW_CONFLICT: 'Contradicción → persona',
  REVIEW_INSUFFICIENT: 'Falta evidencia → persona',
};
/**
 * Cuánto resuelve la máquina y cuánto queda para una persona. La meta no es
 * cero personas: es que una persona solo vea lo que de verdad tiene duda, y que
 * "vencidos esperando revisión" tienda a cero.
 */
export default function AutomationPanel({
  mode,
  decisions,
  sources,
  expiredWaiting,
  oldestPending,
}: {
  mode: string;
  decisions: Fila[];
  sources: Fila[];
  expiredWaiting: number;
  oldestPending: string | null;
}) {
  // Una decisión por evento: la última.
  const ultima = new Map<unknown, Fila>();
  for (const d of decisions) if (!ultima.has(d.event_id)) ultima.set(d.event_id, d);
  const finales = [...ultima.values()];
  const total = finales.length;
  const cuenta = (k: string) => finales.filter((d) => d.decision === k).length;
  const humanos = cuenta('REVIEW_CONFLICT') + cuenta('REVIEW_INSUFFICIENT');
  const conHistorial = sources.filter((s) => Number(s.reviewed_n || 0) > 0);
  const diasEspera = oldestPending ? Math.floor((Date.now() - Date.parse(oldestPending)) / 86_400_000) : null;
  return (
    <section className="auto-panel" aria-labelledby="auto-panel-titulo">
      <h2 id="auto-panel-titulo">Automatización</h2>
      <p>
        Motor en modo <strong>{mode === 'active' ? 'activo (aplica decisiones)' : 'sombra (solo anota lo que haría)'}</strong>.
        Últimos 30 días, {total} eventos evaluados: {pct(total - humanos, total)} % resueltos sin persona,{' '}
        {pct(humanos, total)} % necesitan una.
      </p>
      <ul className="stat-lista">
        {Object.keys(NOMBRES).map((k) => (
          <li key={k}>
            <span className="stat-etiqueta">{NOMBRES[k]}</span>
            <span className="stat-barra" aria-hidden="true">
              <span style={{ width: `${pct(cuenta(k), total)}%` }} />
            </span>
            <span className="stat-cifra">
              {cuenta(k)} · {pct(cuenta(k), total)} %
            </span>
          </li>
        ))}
      </ul>
      <p>
        Vencidos esperando revisión: <strong>{expiredWaiting}</strong> (debe tender a cero).{' '}
        {diasEspera !== null ? `El pendiente más antiguo lleva ${diasEspera} días en cola.` : 'No hay pendientes.'}
      </p>
      <h3>Precisión aprendida por fuente</h3>
      {conHistorial.length ? (
        <div className="table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Fuente</th>
                <th scope="col">Verificados</th>
                <th scope="col">Coinciden</th>
                <th scope="col">Errores graves</th>
                <th scope="col">Precisión mínima probable</th>
                <th scope="col">Nivel ganado</th>
              </tr>
            </thead>
            <tbody>
              {conHistorial.map((s) => (
                <tr key={String(s.id)}>
                  <th scope="row">
                    {String(s.name)}
                    {s.trust_reason ? <small>{String(s.trust_reason)}</small> : null}
                  </th>
                  <td>{Number(s.reviewed_n)}</td>
                  <td>{Number(s.confirmed_n)}</td>
                  <td>{Number(s.serious_errors)}</td>
                  <td>{s.precision_lb !== null ? `${Math.round(Number(s.precision_lb) * 100)} %` : '—'}</td>
                  <td>{String(s.earned_trust || '—')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>Todavía ninguna fuente tiene eventos verificados por una persona para medirla.</p>
      )}
    </section>
  );
}
