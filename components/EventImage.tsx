'use client';
import Image from 'next/image';
import { useState } from 'react';
export default function EventImage({
  src,
  title,
  category,
  priority = false,
}: {
  src?: string | null;
  title: string;
  category: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="event-art">
      {src && !failed ? (
        <Image
          src={src}
          alt={`Flyer de ${title}`}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1000px) 50vw, 33vw"
          priority={priority}
          onError={() => setFailed(true)}
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className={`flyer-fallback art-${category}`}>
          <span>LA NOCHE ES LOCAL</span>
          <span className="art-symbol" aria-hidden="true">
            ✳
          </span>
          <strong>{category === 'electronica' ? 'TECHNO' : category.toUpperCase()}</strong>
          <small>{src ? 'Flyer no disponible' : 'Sin flyer disponible'}</small>
        </div>
      )}
    </div>
  );
}
