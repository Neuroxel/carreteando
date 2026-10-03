"use client";
import Image from 'next/image';
import { useState } from 'react';
import type { TipoEvento } from '../lib/types';

/** Official artwork stays whole; a failed source becomes an honest text panel. */
export default function EventImage({ src, title, lugar, ciudad, priority = false }: {
  src?: string | null; title: string; category: string; tipo?: TipoEvento;
  lugar?: string | null; ciudad?: string | null; zona?: string | null; priority?: boolean;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  return <div className="event-art">
    {src && failedSrc !== src ? <Image src={src} alt={`Flyer de ${title}`} fill
      sizes="(max-width: 640px) calc(100vw - 36px), (max-width: 1000px) 46vw, 590px"
      priority={priority} loading={priority ? undefined : 'lazy'}
      onError={() => setFailedSrc(src)} referrerPolicy="no-referrer" /> :
      <div className="flyer-fallback">
        <span className="eyebrow">Sin afiche disponible</span>
        <strong>{title}</strong>
        <span>{[lugar, ciudad].filter(Boolean).join(' · ')}</span>
      </div>}
  </div>;
}
