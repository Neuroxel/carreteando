'use client';
import Link from 'next/link';
import { track } from '../lib/metrics';
import { useState } from 'react';
import { CATEGORIAS, CIUDADES } from '../lib/types';
export default function SubmissionForm({ today }: { today: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [duplicate, setDuplicate] = useState(false);
  const [error, setError] = useState('');
  const [started, setStarted] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setState('sending');
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const response = await fetch('/api/publicar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, precio: data.precio === '' ? null : Number(data.precio) }),
        signal: AbortSignal.timeout(15000),
      });
      const result = await response.json();
      if (!response.ok || !['pending', 'received_before'].includes(result.status))
        throw new Error(result.error || 'No se pudo confirmar el envío.');
      setDuplicate(result.status === 'received_before');
      setState('done');
      if (result.status === 'pending') track('submission_complete');
    } catch (e) {
      setError(
        e instanceof Error && e.name === 'TimeoutError'
          ? 'No pudimos confirmar la recepción. Puedes reintentar; evitamos envíos duplicados.'
          : e instanceof Error
            ? e.message
            : 'No se pudo enviar.',
      );
      setState('idle');
    }
  }
  if (state === 'done')
    return (
      <div className="empty-state submission-success" role="status">
        <div>
          <span className="eyebrow">
            {duplicate ? 'PROPUESTA YA RECIBIDA' : 'RECIBIDO · PENDIENTE DE REVISIÓN'}
          </span>
          <h2>Gracias por pasar el dato.</h2>
          <p>
            {duplicate
              ? 'Esta propuesta ya fue recibida. Volver a enviarla no cambia el estado de su revisión ni la publica de nuevo.'
              : 'Recibimos tu evento. Lo revisaremos antes de publicarlo. Enviarlo no garantiza su aprobación y todavía no tiene una página pública.'}
          </p>
          <Link href="/" className="button button-primary">
            Volver a la cartelera
          </Link>
        </div>
      </div>
    );
  return (
    <form
      onFocus={() => {
        if (!started) {
          setStarted(true);
          track('submission_start');
        }
      }}
      onSubmit={submit}
      className="event-form"
    >
      <fieldset disabled={state === 'sending'}>
        <legend className="sr-only">Información del evento</legend>
        <div className="form-section">
          <span className="eyebrow">01 / EL PLAN</span>
          <label>
            Nombre del evento
            <input
              name="nombre"
              required
              minLength={4}
              maxLength={160}
              placeholder="¿Cómo se llama la noche?"
            />
          </label>
          <label>
            Descripción
            <textarea
              name="descripcion"
              required
              minLength={20}
              maxLength={3500}
              rows={4}
              placeholder="Música, formato, condiciones de entrada y lo que necesitamos saber."
            />
          </label>
          <div className="form-grid">
            <label>
              Fecha
              <input name="fecha" type="date" required min={today} />
            </label>
            <label>
              Hora de inicio <small>Opcional</small>
              <input name="hora" type="time" />
            </label>
          </div>
          <label>
            Estilo
            <select name="categoria" required defaultValue="">
              <option value="" disabled>
                Selecciona un estilo
              </option>
              {CATEGORIAS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="form-section">
          <span className="eyebrow">02 / DÓNDE Y CUÁNTO</span>
          <div className="form-grid">
            <label>
              Lugar o recinto
              <input name="lugar" required minLength={3} maxLength={160} />
            </label>
            <label>
              Zona
              <select name="ciudad" required defaultValue="">
                <option value="" disabled>
                  Selecciona una zona
                </option>
                {CIUDADES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Dirección <small>Opcional; no compartas domicilios privados</small>
            <input name="direccion" maxLength={240} />
          </label>
          <div className="form-grid">
            <label>
              Entrada en CLP <small>0 si es gratis; vacío si no se sabe</small>
              <input
                name="precio"
                type="number"
                min="0"
                max="500000"
                step="1"
                placeholder="Por confirmar"
              />
            </label>
            <label>
              Condiciones del precio <small>Opcional</small>
              <input
                name="precio_texto"
                maxLength={160}
                placeholder="Ej. preventa, lista hasta cierta hora"
              />
            </label>
          </div>
        </div>
        <div className="form-section">
          <span className="eyebrow">03 / LA FUENTE</span>
          <label>
            Organizador
            <input
              name="organizador"
              required
              minLength={2}
              maxLength={100}
              placeholder="Nombre o cuenta pública"
            />
          </label>
          <label>
            Enlace a la publicación original
            <input
              name="fuente_url"
              type="url"
              required
              maxLength={1200}
              placeholder="https://www.instagram.com/p/…"
            />
            <small>Debe permitir contrastar el evento. No pedimos contraseñas.</small>
          </label>
          <label>
            Enlace al flyer <small>Opcional</small>
            <input name="imagen_url" type="url" maxLength={1200} placeholder="https://…" />
          </label>
        </div>
        <div className="honeypot" aria-hidden="true">
          <label>
            Sitio web
            <input name="website" tabIndex={-1} autoComplete="off" />
          </label>
        </div>
        <p className="form-note">
          Sólo vida nocturna de la Región de Valparaíso. Revisamos manualmente la información; no
          hay publicación inmediata ni plazo de revisión garantizado.{' '}
          <Link href="/confianza">Fuentes y privacidad</Link>.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="button button-primary button-full" type="submit">
          {state === 'sending' ? 'Enviando…' : 'Enviar a revisión ↗'}
        </button>
      </fieldset>
    </form>
  );
}
