'use client';
import { useEffect, useState } from 'react';
import { track } from '../lib/metrics';
import { CIUDADES } from '../lib/types';
/**
 * "¿Falta un lugar?" y "Reclama tu ficha" son el mismo formulario corto: el
 * nombre, la comuna y algo que se pueda comprobar. Nada se publica sin que
 * una persona lo contraste con esa fuente.
 */
export default function VenueProposalForm() {
  const [abierto, setAbierto] = useState(false);
  const [ficha, setFicha] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [done, setDone] = useState('');
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    if (p.get('tipo') === 'lugar') setAbierto(true);
    const f = p.get('lugar');
    if (f && /^[a-z0-9-]{1,80}$/.test(f)) setFicha(f);
  }, []);
  return (
    <details className="report-box venue-proposal" id="falta-un-lugar" open={abierto}>
      <summary>{ficha ? 'Reclamar o corregir la ficha de un lugar' : '¿Falta un lugar?'}</summary>
      {done ? (
        <p role="status">{done}</p>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setStatus('');
            const data = Object.fromEntries(new FormData(e.currentTarget));
            try {
              const r = await fetch('/api/proponer-lugar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...data, ficha }),
                signal: AbortSignal.timeout(15000),
              });
              const b = await r.json();
              if (!r.ok) throw new Error(b.error || 'No se pudo enviar.');
              if (b.status !== 'received_before') track('venue_proposal');
              setDone(b.message || 'Recibido.');
            } catch (err) {
              setStatus(err instanceof Error ? err.message : 'No se pudo enviar.');
            } finally {
              setBusy(false);
            }
          }}
        >
          <p>
            Bares, clubes, salas o espacios donde se sale de noche. Necesitamos algo comprobable: su
            Instagram o su sitio. No incluyas datos personales.
          </p>
          <label>
            Nombre del lugar
            <input name="nombre" required minLength={2} maxLength={120} />
          </label>
          <label>
            Comuna
            <select name="ciudad" required defaultValue="">
              <option value="" disabled>
                Elige una
              </option>
              {CIUDADES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label>
            Dirección (opcional)
            <input name="direccion" maxLength={160} />
          </label>
          <label>
            Instagram o sitio del lugar
            <input name="fuente_url" type="url" required maxLength={1200} placeholder="https://instagram.com/…" />
          </label>
          <label>
            Tú eres…
            <select name="relacion" required defaultValue={ficha ? 'dueno' : 'publico'}>
              <option value="publico">Alguien que va</option>
              <option value="dueno">Del equipo del lugar</option>
            </select>
          </label>
          <label>
            Algo más (horario, qué se hace ahí, qué corregir)
            <textarea name="detalle" maxLength={1000} rows={3} />
          </label>
          <div className="honeypot" aria-hidden="true">
            <input name="website" tabIndex={-1} aria-label="Sitio web" autoComplete="off" />
          </div>
          <p role="status">{status}</p>
          <button disabled={busy} className="button button-primary">
            {busy ? 'Enviando…' : 'Enviar lugar'}
          </button>
          <p className="trust-note">Aparecer en Dónde Salgo? no se paga. Pagar nunca cambia lo que verificamos.</p>
        </form>
      )}
    </details>
  );
}
