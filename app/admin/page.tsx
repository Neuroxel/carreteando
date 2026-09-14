import sources from '../../data/sources.json';
import { isAdmin } from '../../lib/admin-session';
import { getAdminDb } from '../../lib/server-db';
import { login, logout, review, importEditorial } from './actions';
import { CATEGORIAS, CIUDADES } from '../../lib/types';
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
  const db = getAdminDb();
  const [queue, events, audit, metrics] = await Promise.all([
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
      .select('created_at,target,action,note')
      .order('created_at', { ascending: false })
      .limit(20),
    db
      ?.from('metrics_daily')
      .select('day,name,count')
      .order('day', { ascending: false })
      .limit(270),
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
    invalid: 'No se guardó. Revisa los campos, la confirmación de fuente y la nota.',
    failed: 'No se guardó. Puede existir un duplicado o un problema de conexión.',
  };
  return (
    <section className="container page-section admin-page">
      <p className="eyebrow">REVISIÓN PRIVADA</p>
      <h1>Una cartelera confiable.</h1>
      <form action={logout}>
        <button className="button button-outline">Cerrar sesión</button>
      </form>
      <p>
        La cola puede esperar: lo no aprobado permanece privado. Los eventos pasados dejan de
        mostrarse aunque nadie abra esta página. Aprobar es una decisión explícita; guardar una
        corrección conserva el estado de publicación.
      </p>
      {params.status && statuses[String(params.status)] && (
        <p role="status">{statuses[String(params.status)]}</p>
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
          <h2>Cobertura y fuentes</h2>
          <form action={importEditorial}>
            <button className="button button-outline">Importar selección editorial revisada</button>
          </form>
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
