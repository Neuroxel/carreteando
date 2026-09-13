'use client';
import { useState } from 'react';
import { SITE_URL } from '../lib/site';
export default function ShareButton({
  id,
  title,
  compact = false,
}: {
  id: string;
  title: string;
  compact?: boolean;
}) {
  const [message, setMessage] = useState('');
  const [fallback, setFallback] = useState(false);
  const url = `${SITE_URL}/evento/${encodeURIComponent(id)}`;
  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title, text: `${title} · ¿Vamos?`, url });
        return;
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setMessage('Enlace copiado');
    } catch {
      setFallback(true);
      setMessage('Copia el enlace para compartir');
    }
  }
  return (
    <div className="share-control">
      <button
        type="button"
        className={compact ? 'icon-button' : 'button button-light'}
        onClick={share}
        aria-label={`Compartir ${title}`}
      >
        <span aria-hidden="true">↗</span>
        {!compact && ' Compartir'}
      </button>
      <span className="share-status" role="status">
        {message}
      </span>
      {fallback && (
        <input
          readOnly
          aria-label="Enlace del evento"
          value={url}
          onFocus={(e) => e.currentTarget.select()}
        />
      )}
    </div>
  );
}
