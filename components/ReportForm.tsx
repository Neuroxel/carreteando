'use client';
import { useState } from 'react';
export default function ReportForm({ id }: { id: string }) {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  return (
    <details className="report-box" id="reportar">
      <summary>Reportar información incorrecta</summary>
      <p>Cuéntanos qué cambió y cómo lo podemos comprobar. No incluyas datos personales.</p>
      {done ? (
        <p role="status">
          Recibimos tu reporte para revisión. Gracias por ayudar a mantener la cartelera.
        </p>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setStatus('');
            const data = Object.fromEntries(new FormData(e.currentTarget));
            try {
              const r = await fetch('/api/reportar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...data, evento: id }),
                signal: AbortSignal.timeout(15000),
              });
              const b = await r.json();
              if (!r.ok) throw new Error(b.error || 'No se pudo enviar.');
              setDone(true);
            } catch (e) {
              setStatus(e instanceof Error ? e.message : 'No se pudo enviar.');
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Qué hay que corregir
            <select name="motivo" required>
              <option value="fecha">Fecha u hora</option>
              <option value="lugar">Lugar</option>
              <option value="precio">Precio</option>
              <option value="cancelado">Cancelación</option>
              <option value="duplicado">Evento duplicado</option>
              <option value="otro">Otro dato</option>
            </select>
          </label>
          <label>
            Detalle
            <textarea name="detalle" minLength={10} maxLength={1000} required rows={3} />
          </label>
          <div className="honeypot" aria-hidden="true">
            <input name="website" tabIndex={-1} aria-label="Sitio web" autoComplete="off" />
          </div>
          <p role="status">{status}</p>
          <button disabled={busy} className="button button-outline">
            {busy ? 'Enviando…' : 'Enviar corrección'}
          </button>
        </form>
      )}
    </details>
  );
}
