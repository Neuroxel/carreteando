'use client';
import { useState } from 'react';
import { LIVE_KINDS, LIVE_KIND_LIST, LiveSummary } from '../lib/live-reports';
import { track } from '../lib/metrics';
export default function LiveReport({
  tipo,
  id,
  resumen,
}: {
  tipo: 'venue' | 'event';
  id: string;
  resumen: LiveSummary[];
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  async function send(kind: string, valor: string) {
    setBusy(true);
    try {
      const r = await fetch('/api/ambiente', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tipo, id, kind, valor }),
      });
      if (r.status === 429) setStatus('Ya recibimos varios reportes tuyos. Intenta más tarde.');
      else if (!r.ok) setStatus('No pudimos registrar tu reporte. Intenta más tarde.');
      else {
        setStatus('Gracias. Tu reporte se cuenta por un rato y luego caduca.');
        track('live_report');
      }
    } catch {
      setStatus('No pudimos registrar tu reporte. Intenta más tarde.');
    }
    setBusy(false);
  }
  return (
    <section className="live-box">
      <h2>
        Cómo está ahora
        <span className="heading-period">.</span>
      </h2>
      {resumen.length ? (
        <ul className="live-summary">
          {resumen.map((r) => (
            <li key={r.kind}>
              <strong>{r.valueLabel}</strong>
              <span>
                {r.label.replace('¿', '').replace('?', '')} · {r.count} de {r.total}{' '}
                {r.total === 1 ? 'reporte' : 'reportes'} · hace {r.minutes} min
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p>
          Todavía no hay reportes recientes suficientes. Si estás ahí, cuéntanos cómo está: dos
          reportes que coincidan ya sirven a quien viene después.
        </p>
      )}
      <button type="button" className="button button-outline" onClick={() => setOpen(!open)}>
        {open ? 'Cerrar' : 'Reportar cómo está'}
      </button>
      {open && (
        <div className="live-form">
          {LIVE_KIND_LIST.map((kind) => (
            <div key={kind}>
              <p className="eyebrow">{LIVE_KINDS[kind].label}</p>
              <div className="actions">
                {LIVE_KINDS[kind].values.map((v) => (
                  <button
                    key={v.value}
                    type="button"
                    className="chip"
                    disabled={busy}
                    onClick={() => send(kind, v.value)}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <p className="trust-note" role="status">
            {status ||
              'Son reportes de la comunidad, no mediciones. Caducan solos entre 45 minutos y 2 horas.'}
          </p>
        </div>
      )}
    </section>
  );
}
