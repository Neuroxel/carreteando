import sources from '../../data/sources.json';
import { currentActor, isAdmin } from '../../lib/admin-session';
import { getAdminDb } from '../../lib/server-db';
import { login, logout, review, reviewVenue, importEditorial, runIngestion } from './actions';
import AdminStats from '../../components/AdminStats';
import { CATEGORIAS, CIUDADES } from '../../lib/types';
import { TIPOS_LUGAR } from '../../lib/venues';
import { safeWebUrl } from '../../lib/safety';
import { toChileDateString } from '../../lib/event-extraction';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Revisión de eventos', robots: { index: false, follow: false } };
type Row = Record<string, unknown>;
const string = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v) : '');
function Fields({ row }: { row: Row }) {
  const fields = [
    ['nombre', 'Nombre', 'title'],
    ['fecha', 'Fecha', 'date_text'],
    ['hora', 'Hora (vacía si desconocida)', 'event_time'],
    ['lugar', 'Recinto', 'venue'],
    ['direccion', 'Dirección', 'address'],
    ['precio', 'Precio CLP (vacío si desconocido)', 'price_clp'],
    ['precio_texto', 'Condiciones del precio', 'price_text'],
    ['organizador', 'Organizador', 'username'],
    ['fuente_url', 'Publicación original', 'instagram_url'],
    ['imagen_url', 'Imagen pública permitida', 'image_url'],
  ];
  return (
    <div className="admin-fields">
      {fields.map(([name, label, column]) => (
        <label key={name}>
          {label}
          <input
            name={name}
            defaultValue={string(row[column] ?? row[name])}
            type={
              name === 'fecha'
                ? 'date'
                : name === 'hora'
                  ? 'time'
                  : name === 'precio'
                    ? 'number'
                    : 'text'
            }
            maxLength={name.includes('url') ? 1200 : 240}
            min={name === 'precio' ? 0 : undefined}
            max={name === 'precio' ? 500000 : undefined}
          />
        </label>
      ))}
      <label>
        Ciudad
        <select name="ciudad" defaultValue={string(row.city ?? row.ciudad)}>
          <option value="">Selecciona</option>
          {CIUDADES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <label>
        Estilo
        <select name="categoria" defaultValue={string(row.category ?? row.categoria) || 'otro'}>
          {CATEGORIAS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <label className="admin-wide">
        Descripción
        <textarea
          name="descripcion"
          defaultValue={string(row.description ?? row.descripcion)}
          maxLength={3500}
          rows={3}
        />
      </label>
      <label className="admin-wide">
        <input type="checkbox" name="checked" value="yes" /> Revisé la fuente: fecha, ciudad,
        recinto y pertinencia. Dejé hora y precio vacíos si no están confirmados.
      </label>
    </div>
  );
}
function Item({ row, kind, events }: { row: Row; kind: 'event' | 'inbox'; events: Row[] }) {
  const payload =
    kind === 'inbox' && row.payload && typeof row.payload === 'object' ? (row.payload as Row) : row;
  const report = row.kind === 'report';
  const url = safeWebUrl(payload.instagram_url ?? payload.fuente_url);
  const duplicates = events.filter(
    (e) =>
      e.id !== row.id &&
      e.date_text === (payload.date_text ?? payload.fecha) &&
      (e.venue === (payload.venue ?? payload.lugar) ||
        e.title === (payload.title ?? payload.nombre)),
  );
  return (
    <details className="admin-item">
      <summary>
        {string(payload.title ?? payload.nombre) ||
          (report ? `Reporte: ${string(payload.evento)}` : 'Candidato sin título')}{' '}
        <span>
          · {string(row.moderation_status ?? row.status)}{' '}
          {row.is_active === false ? '· privado' : ''}
        </span>
      </summary>
      <p>
        Fecha: {string(payload.date_text ?? payload.fecha) || 'Sin confirmar'} · Última revisión:{' '}
        {string(row.last_verified_at ?? row.reviewed_at) || 'Sin revisión'} · Fuente:{' '}
        {string(row.source) || 'Comunidad'}
      </p>
      {url && (
        <p>
          <a href={url} target="_blank" rel="noopener noreferrer">
            Abrir fuente original ↗
          </a>
        </p>
      )}
      {duplicates.length > 0 && (
        <p className="form-error">
          Posibles coincidencias: {duplicates.map((d) => string(d.title)).join(' / ')}. Compara
          antes de aprobar.
        </p>
      )}
      {report && (
        <p>
          Motivo: {string(payload.motivo)}. {string(payload.detalle)}. Corrige o retira el evento en
          la sección de cartelera antes de marcar este reporte resuelto.
        </p>
      )}
      <form action={review.bind(null, kind, string(row.id), Number(row.revision), 'save')}>
        {!report && <Fields row={payload} />}
        <label>
          Nota de revisión (mínimo 10 caracteres)
          <textarea name="note" required minLength={10} maxLength={1000} rows={2} />
        </label>
        <div className="actions">
          {!report && (
            <button className="button button-primary" formAction={review.bind(null, kind, string(row.id), Number(row.revision), 'approve')}>
              Aprobar y publicar
            </button>
          )}
          {kind === 'event' && (
            <>
              <button className="button button-outline" formAction={review.bind(null, kind, string(row.id), Number(row.revision), 'save')}>
                Guardar corrección
              </button>
              <button className="button button-outline" formAction={review.bind(null, kind, string(row.id), Number(row.revision), 'withdraw')}>
                Retirar de cartelera
              </button>
            </>
          )}
          {report && (
            <button className="button button-primary" formAction={review.bind(null, kind, string(row.id), Number(row.revision), 'resolve')}>
              Marcar resuelto
            </button>
          )}
          <button className="button button-outline" formAction={review.bind(null, kind, string(row.id), Number(row.revision), 'reject')}>
            Rechazar
          </button>
        </div>
      </form>
    </details>
  );
}

type SourceRow = Record<string, unknown>;
/**
 * Health is a judgement, not a column: a source that answers happily every night
 * and has never produced an event is not "ok", it is a source we should stop
 * paying attention to.
 */
function sourceHealth(row: SourceRow) {
  const fails = Number(row.consecutive_failures || 0);
  const checked = row.last_checked_at ? String(row.last_checked_at) : null;
  const staleAfter = (Number(row.refresh_hours || 24) + 24) * 3600_000;
  if (!row.active) return { label: 'pausada', tone: 'neutral' };
  if (fails >= 3) return { label: 'caída', tone: 'bad' };
  if (fails > 0) return { label: 'degradada', tone: 'warn' };
  if (!checked) return { label: 'sin revisar', tone: 'neutral' };
  if (Date.now() - Date.parse(checked) > staleAfter) return { label: 'atrasada', tone: 'warn' };
  if (Number(row.unique_event_count || 0) === 0) return { label: 'sin resultados', tone: 'warn' };
  return { label: 'al día', tone: 'good' };
}
function whenLabel(value: unknown) {
  if (!value) return '—';
  const time = Date.parse(String(value));
  if (Number.isNaN(time)) return '—';
  const minutes = Math.round((Date.now() - time) / 60000);
  if (minutes < 0) return `en ${Math.abs(minutes) < 90 ? `${Math.abs(minutes)} min` : `${Math.round(Math.abs(minutes) / 60)} h`}`;
  if (minutes < 90) return `hace ${minutes} min`;
  if (minutes < 2880) return `hace ${Math.round(minutes / 60)} h`;
  return `hace ${Math.round(minutes / 1440)} días`;
}
function SourceHealth({ rows, error }: { rows: SourceRow[]; error: boolean }) {
  if (error)
    return <p role="alert">No se pudo leer el registro de fuentes.</p>;
  if (!rows.length)
    return (
      <p>
        Todavía no hay fuentes registradas. Se registran solas en la primera revisión.
      </p>
    );
  const problemas = rows.filter((r) => ['caída', 'degradada', 'sin resultados', 'atrasada'].includes(sourceHealth(r).label));
  return (
    <>
      <p>
        {rows.length} fuentes registradas
        {problemas.length ? ` · ${problemas.length} necesitan atención` : ' · todas al día'}.
        Los conteos son los de la última revisión de cada fuente, no acumulados.
      </p>
      <div className="table-scroll">
        <table className="admin-table source-table">
          <caption className="visually-hidden">Estado de las fuentes automáticas</caption>
          <thead>
            <tr>
              <th scope="col">Fuente</th>
              <th scope="col">Comuna</th>
              <th scope="col">Estado</th>
              <th scope="col">Revisada</th>
              <th scope="col">Con éxito</th>
              <th scope="col">Próxima</th>
              <th scope="col">Ítems</th>
              <th scope="col">Eventos</th>
              <th scope="col">Duplicados</th>
              <th scope="col">Sin leer</th>
              <th scope="col">Costo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const health = sourceHealth(row);
              return (
                <tr key={String(row.id)}>
                  <th scope="row">
                    <a href={String(row.public_url)} rel="noreferrer noopener nofollow" target="_blank">
                      {String(row.name)}
                    </a>
                    <small>
                      {String(row.source_type)} ·{' '}
                      {row.trust === 'auto' ? 'puede publicar sola' : 'siempre a revisión'}
                    </small>
                    {row.last_error ? <small className="source-error">último error: {String(row.last_error)}</small> : null}
                  </th>
                  <td>{String(row.commune || '—')}</td>
                  <td>
                    <span className={`source-state source-${health.tone}`}>{health.label}</span>
                  </td>
                  <td>{whenLabel(row.last_checked_at)}</td>
                  <td>{whenLabel(row.last_success_at)}</td>
                  <td>{whenLabel(row.next_check_at)}</td>
                  <td>{Number(row.items_found || 0)}</td>
                  <td>{Number(row.unique_event_count || 0)}</td>
                  <td>{Number(row.duplicate_count || 0)}</td>
                  <td>{Number(row.parse_failure_count || 0)}</td>
                  <td>{Number(row.cost_clp || 0) === 0 ? 'sin costo' : `$${Number(row.cost_clp)}`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
function VenueItem({ row }: { row: Row }) {
  const fields: [string, string][] = [
    ['name', 'Nombre'],
    ['city', 'Ciudad'],
    ['zone', 'Zona o barrio'],
    ['address', 'Dirección'],
    ['description_short', 'Descripción breve'],
    ['official_url', 'Sitio oficial'],
    ['instagram_url', 'Instagram'],
    ['calendar_url', 'Cartelera del lugar'],
    ['source_url', 'Fuente revisada'],
  ];
  const bind = (action: string) =>
    reviewVenue.bind(null, string(row.id), Number(row.revision), action);
  return (
    <details className="admin-item">
      <summary>
        {string(row.name) || 'Lugar sin nombre'}{' '}
        <span>
          · {string(row.moderation_status)} {row.is_active === false ? '· privado' : ''}
        </span>
      </summary>
      <p>
        {string(row.venue_type)} · {string(row.city)}
        {row.zone ? ` · ${string(row.zone)}` : ''} · Última revisión:{' '}
        {string(row.last_verified_at) || 'Sin revisión'}
      </p>
      <form action={bind('save')}>
        <div className="admin-fields">
          {fields.map(([name, label]) =>
            name === 'city' ? (
              <label key={name}>
                {label}
                <select name="city" defaultValue={string(row.city)}>
                  <option value="">Selecciona</option>
                  {CIUDADES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
            ) : (
              <label key={name}>
                {label}
                <input name={name} defaultValue={string(row[name])} maxLength={400} />
              </label>
            ),
          )}
          <label>
            Tipo de lugar
            <select name="venue_type" defaultValue={string(row.venue_type) || 'bar'}>
              {TIPOS_LUGAR.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-wide">
            <input type="checkbox" name="checked" value="yes" /> Comprobé que el lugar existe hoy,
            que su fuente es pública y que es vida nocturna.
          </label>
        </div>
        <label>
          Nota de revisión (mínimo 10 caracteres)
          <textarea name="note" required minLength={10} maxLength={1000} rows={2} />
        </label>
        <div className="actions">
          <button className="button button-primary" formAction={bind('approve')}>
            Aprobar y publicar
          </button>
          <button className="button button-outline" formAction={bind('save')}>
            Guardar corrección
          </button>
          <button className="button button-outline" formAction={bind('withdraw')}>
            Retirar
          </button>
          <button className="button button-outline" formAction={bind('reject')}>
            Rechazar
          </button>
        </div>
      </form>
    </details>
  );
}
export default async function Admin({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  if (!(await isAdmin()))
    return (
      <section className="container page-section admin-page">
        <p className="eyebrow">ACCESO DEL PROPIETARIO</p>
        <h1>Revisar la cartelera.</h1>
        <p>Acceso privado. La sesión vence después de dos horas.</p>
        {params.status === 'login-failed' && (
          <p role="alert">No se pudo iniciar sesión. Comprueba la clave o intenta más tarde.</p>
        )}
        <form action={login}>
          <label>
            Clave de acceso
            <input
              name="token"
              type="password"
              required
              maxLength={200}
              autoComplete="current-password"
            />
          </label>
          <button className="button button-primary">Entrar</button>
        </form>
      </section>
    );
  const actor = await currentActor();
  const db = getAdminDb();
  const [queue, events, audit, metrics, venues, sourceRows] = await Promise.all([
    db
      ?.from('community_inbox')
      .select('id,kind,payload,status,revision,reviewed_at')
      .eq('status', 'pending')
      .order('created_at')
      .limit(100),
    db
      ?.from('events')
      .select('*')
      .or(`moderation_status.eq.pending,date_text.gte.${toChileDateString(new Date())}`)
      .order('date_text')
      .limit(300),
    db
      ?.from('review_audit')
      .select('created_at,target,action,note,actor')
      .order('created_at', { ascending: false })
      .limit(20),
    db
      ?.from('metrics_daily')
      .select('day,name,count')
      .order('day', { ascending: false })
      .limit(270),
    db
      ?.from('venues')
      .select('*')
      .order('moderation_status')
      .order('name')
      .limit(400),
    db
      ?.from('event_sources')
      .select(
        'id,name,source_type,commune,trust,active,public_url,refresh_hours,last_checked_at,last_success_at,last_failure_at,last_error,next_check_at,items_found,candidate_count,unique_event_count,duplicate_count,parse_failure_count,consecutive_failures,cost_clp',
      )
      .order('commune')
      .order('name')
      .limit(100),
  ]);
  const failed = !db || queue?.error || events?.error || audit?.error;
  const list = events?.data || [];
  const today = toChileDateString(new Date());
  const current = list.filter(r => r.date_text && r.date_text >= today);
  const older = list.filter(r => !r.date_text || r.date_text < today);
  const statuses: Record<string, string> = {
    imported: 'Selección editorial importada. Los registros existentes conservaron su estado.',
    saved: 'Cambio guardado.',
    conflict:
      'El elemento cambió en otra sesión. Revisa su estado actualizado antes de volver a enviar.',
    invalid: 'No se guardó. La acción llegó incompleta; vuelve a abrir el elemento e inténtalo.',
    'invalid-note': 'No se guardó. La nota de revisión necesita entre 10 y 1000 caracteres.',
    'invalid-check':
      'No se guardó. Marca la casilla de revisión de la fuente antes de aprobar o guardar.',
    'invalid-fields':
      'No se guardó. Revisa los campos del evento: el recinto, la comuna, el estilo y la publicación original son obligatorios, y la fecha debe ser de hoy en adelante.',
    unavailable: 'No se guardó. No hay conexión con la base de datos. No tomes decisiones hasta recuperarla.',
    failed: 'No se guardó. Puede existir un duplicado o un problema de conexión.',
    'ingesta-al-dia': 'Ninguna fuente tocaba todavía. Cada una tiene su propio ritmo de revisión.',
  };
  const ingesta = String(params.status || '').match(/^ingesta-(\d+)$/);
  const campo = typeof params.campo === 'string' ? params.campo.slice(0, 200) : '';
  const statusText = ingesta
    ? `Se revisaron ${ingesta[1]} fuentes. El detalle quedó en la tabla de fuentes automáticas.`
    : campo && statuses[String(params.status)]
      ? `${statuses[String(params.status)]} ${campo}`
      : statuses[String(params.status)];
  return (
    <section className="container page-section admin-page">
      <p className="eyebrow">REVISIÓN PRIVADA · {(actor || 'sesión').toUpperCase()}</p>
      <h1>Una cartelera confiable.</h1>
      <p className="trust-note">
        Estás moderando como <strong>{actor || 'desconocido'}</strong>. Cada cambio que hagas queda
        registrado con tu nombre.
      </p>
      <form action={logout}>
        <button className="button button-outline">Cerrar sesión</button>
      </form>
      <p>
        La cola puede esperar: lo no aprobado permanece privado. Los eventos pasados dejan de
        mostrarse aunque nadie abra esta página. Aprobar es una decisión explícita; guardar una
        corrección conserva el estado de publicación.
      </p>
      {params.status && statusText && (
        <p role="status">{statusText}</p>
      )}
      {failed ? (
        <p role="alert">
          No pudimos cargar la revisión completa. No tomes decisiones hasta recuperar la conexión.
        </p>
      ) : (
        <>
          <h2>Aportes y reportes ({queue?.data.length || 0})</h2>
          {queue?.data.length ? (
            queue.data.map((r) => <Item key={r.id} row={r} kind="inbox" events={list} />)
          ) : (
            <p>No hay aportes pendientes.</p>
          )}
          <h2>Candidatos y cartelera ({current.length})</h2>
          {current.map((r) => (
            <Item key={r.id} row={r} kind="event" events={list} />
          ))}
          <details className="admin-item"><summary>Archivo privado: fechas pasadas o sin confirmar ({older.length})</summary>{older.map(r=><Item key={r.id} row={r} kind="event" events={list}/>)}</details>
          <h2>
            Lugares ({venues?.data?.filter((v) => v.moderation_status === 'pending').length || 0}{' '}
            por revisar de {venues?.data?.length || 0})
          </h2>
          <p>
            Un lugar existe aunque hoy no tenga evento. Aprobar lo hace público; retirar lo deja
            privado sin borrar su historial.
          </p>
          {venues?.error ? (
            <p role="alert">No pudimos consultar los lugares.</p>
          ) : (
            <>
              {(venues?.data || [])
                .filter((v) => v.moderation_status === 'pending')
                .map((v) => (
                  <VenueItem key={v.id} row={v} />
                ))}
              <details className="admin-item">
                <summary>
                  Lugares ya publicados (
                  {(venues?.data || []).filter((v) => v.moderation_status !== 'pending').length})
                </summary>
                {(venues?.data || [])
                  .filter((v) => v.moderation_status !== 'pending')
                  .map((v) => (
                    <VenueItem key={v.id} row={v} />
                  ))}
              </details>
            </>
          )}
          <h2>Estado del producto</h2>
          <AdminStats
            venues={venues?.data || []}
            events={list}
            sources={sourceRows?.data || []}
            metrics={metrics?.data || []}
          />
          <h2>Fuentes automáticas</h2>
          <div className="admin-actions">
            <form action={runIngestion}>
              <button className="button button-primary">Revisar fuentes ahora</button>
            </form>
            <form action={importEditorial}>
              <button className="button button-outline">Importar selección editorial revisada</button>
            </form>
          </div>
          <SourceHealth rows={sourceRows?.data || []} error={Boolean(sourceRows?.error)} />
          <h2>Cobertura por recinto</h2>
          <p>
            Los conteos son eventos aprobados vigentes por recinto. Las tasas de error sin muestra
            suficiente se mantienen sin determinar; no significan cero errores.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Fuente / zona</th>
                  <th>Modo / estado</th>
                  <th>Revisada</th>
                  <th>Vigentes</th>
                  <th>Observación</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => (
                  <tr key={s.id}>
                    <td>
                      {s.url ? (
                        <a href={s.url} target="_blank" rel="noopener noreferrer">
                          {s.name}
                        </a>
                      ) : (
                        s.name
                      )}
                      <br />
                      {s.city}
                    </td>
                    <td>
                      {s.mode} / {s.health}
                    </td>
                    <td>{s.last_checked}</td>
                    <td>
                      {s.venue
                        ? list.filter(
                            (e) =>
                              e.venue === s.venue &&
                              e.is_active &&
                              e.moderation_status === 'approved' &&
                              e.date_text >= toChileDateString(new Date()),
                          ).length
                        : '—'}
                    </td>
                    <td>{s.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h2>Uso de los últimos 30 días</h2>
          <p>
            Conteos agregados de acciones, no personas únicas. Sin cookies de seguimiento ni
            historial individual. Compartir mide la intención, no mensajes enviados.
          </p>
          {metrics?.error ? (
            <p>No pudimos consultar las métricas.</p>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Día (Chile)</th>
                    <th>Acción</th>
                    <th>Cantidad</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics?.data.map((r) => (
                    <tr key={`${r.day}-${r.name}`}>
                      <td>{r.day}</td>
                      <td>{r.name}</td>
                      <td>{r.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <h2>Últimas decisiones</h2>
          <ul>
            {audit?.data.map((r, i) => (
              <li key={i}>
                {r.created_at} · {r.target} · {r.action} · {r.note}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
