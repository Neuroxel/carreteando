type Fila = Record<string, unknown>;
/**
 * Lo operativo a la vista; el diagnóstico de precisión, plegado. La meta no es
 * cero personas: es que "vencidos esperando revisión" tienda a cero.
 */
export default function AutomationPanel({
  mode,
  decisions,
  sources,
  expiredWaiting,
  publicNow,
  reviewNow,
}: {
  mode: string;
  decisions: Fila[];
  sources: Fila[];
  expiredWaiting: number;
  publicNow: number;
  reviewNow: number;
}) {
  const aplicadas = decisions.filter((d) => d.applied === true);
  const cuenta = (...k: string[]) => aplicadas.filter((d) => k.includes(String(d.decision))).length;
  const conflictos = decisions.filter((d) => d.decision === 'REVIEW_CONFLICT').length;
  const cifras: [string, number][] = [
    ['Públicos vigentes', publicNow],
    ['En revisión', reviewNow],
    ['Publicados solos (30 días)', cuenta('AUTO_PUBLISH', 'AUTO_PROMOTE_FROM_REVIEW')],
    ['Descartados solos (30 días)', cuenta('AUTO_REJECT')],
    ['Contradicciones (30 días)', conflictos],
    ['Vencidos esperando revisión (30 días)', expiredWaiting],
  ];
  const conHistorial = sources.filter((s) => Number(s.reviewed_n || 0) > 0);
  return (
    <section className="auto-panel" aria-labelledby="auto-panel-titulo">
      <h2 id="auto-panel-titulo">Automatización</h2>
      <p>
        Motor en modo{' '}
        <strong>{mode === 'active' ? 'activo: aplica sus decisiones' : 'sombra: solo anota lo que haría'}</strong>.
        Siete reglas fijas en <code>lib/sources/evidence.ts</code>; ver <code>docs/AUTOMATION.md</code>.
      </p>
      <dl className="auto-cifras">
        {cifras.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <details>
        <summary>Diagnóstico: precisión medida por fuente</summary>
        <p>
          Se compara lo que dijo cada fuente con fichas verificadas por una persona. Es solo para mirar: no
          cambia el nivel de ninguna fuente.
        </p>
        {conHistorial.length ? (
          <div className="table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Fuente</th>
                  <th scope="col">Verificados</th>
                  <th scope="col">Coinciden</th>
                  <th scope="col">Errores críticos</th>
                  <th scope="col">Precisión mínima probable</th>
                </tr>
              </thead>
              <tbody>
                {conHistorial.map((s) => (
                  <tr key={String(s.id)}>
                    <th scope="row">{String(s.name)}</th>
                    <td>{Number(s.reviewed_n)}</td>
                    <td>{Number(s.confirmed_n)}</td>
                    <td>{Number(s.serious_errors)}</td>
                    <td>{s.precision_lb !== null ? `${Math.round(Number(s.precision_lb) * 100)} %` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>Todavía ninguna fuente tiene eventos verificados por una persona para medirla.</p>
        )}
      </details>
    </section>
  );
}
