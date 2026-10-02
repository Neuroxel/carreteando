"use client";
import Image from 'next/image';
import { useState } from 'react';
/** Optional approved venue image or logo; failures leave the finished text card. */
export default function VenueMedia({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (failed === src) return null;
  return <div className="venue-media"><Image src={src} alt={name} fill sizes="96px" loading="lazy" onError={() => setFailed(src)} /></div>;
}
