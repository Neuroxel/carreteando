'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Heart,
  Share2,
  ExternalLink,
  Instagram,
  CheckCircle2,
  Ticket,
  Navigation,
  MessageCircle,
  Sparkles,
} from 'lucide-react';
import { Evento, CATEGORIAS } from '../../../lib/types';
import { getStoredEvents, toggleRsvp, getUserRsvps } from '../../../lib/events-store';
import EventCard from '../../../components/EventCard';

export default function EventoDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [evento, setEvento] = useState<Evento | null>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [related, setRelated] = useState<Evento[]>([]);

  useEffect(() => {
    if (!id) return;
    const all = getStoredEvents();
    const found = all.find((e) => e.id === id);
    if (found) {
      setEvento(found);
      setLikesCount(found.asistentes_interesados || 0);

      const rsvps = getUserRsvps();
      setIsLiked(rsvps.includes(found.id));

      // Relacionados
      const rel = all.filter((e) => e.id !== id && (e.categoria === found.categoria || e.ciudad === found.ciudad)).slice(0, 3);
      setRelated(rel);
    }
  }, [id]);

  if (!evento) {
    return (
      <div className="container" style={{ padding: '80px 0', textAlign: 'center' }}>
        <h2 style={{ fontSize: '24px', marginBottom: '12px' }}>Carrete no encontrado</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
          Este evento puede haber finalizado o sido eliminado.
        </p>
        <Link href="/" className="btn btn-primary">
          Volver a la cartelera
        </Link>
      </div>
    );
  }

  const catMeta = CATEGORIAS.find((c) => c.value === evento.categoria);

  const handleLike = () => {
    const res = toggleRsvp(evento.id);
    setIsLiked(res.interested);
    setLikesCount(res.count);
  };

  const handleShareWhatsApp = () => {
    const text = `¡Apaña a este carrete en ${evento.ciudad}! 🔥 ${evento.nombre} (${evento.fecha} - ${evento.lugar}) 👉 ${window.location.href}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Google Maps search query
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${evento.lugar}, ${evento.ciudad}, Chile`)}`;

  return (
    <div style={{ padding: '32px 0 80px' }}>
      <div className="container">
        {/* Back navigation */}
        <Link
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            color: 'var(--text-secondary)',
            marginBottom: '20px',
          }}
        >
          <ArrowLeft size={16} />
          <span>Volver a la cartelera</span>
        </Link>

        {/* Main Grid: Flyer & Details */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '36px', alignItems: 'start' }}>
          {/* Columna Izquierda: Flyer Principal */}
          <div>
            <div
              className="glass-card"
              style={{
                borderRadius: 'var(--radius-xl)',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <img
                src={
                  evento.imagen_url ||
                  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80'
                }
                alt={evento.nombre}
                style={{
                  width: '100%',
                  aspectRatio: '16/10',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
              <div className="event-card-image-overlay" />

              <div style={{ position: 'absolute', top: '16px', left: '16px', display: 'flex', gap: '8px' }}>
                <span className={`badge ${catMeta?.badgeClass || 'badge-otro'}`} style={{ backdropFilter: 'blur(8px)' }}>
                  <span>{catMeta?.emoji}</span>
                  <span>{catMeta?.label}</span>
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    background: 'rgba(0,0,0,0.7)',
                    color: '#fff',
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-full)',
                    fontWeight: 700,
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  {evento.ciudad}
                </span>
              </div>
            </div>

            {/* Acciones Rápidas para Jóvenes (WhatsApp, RSVP, Maps) */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px', flexWrap: 'wrap' }}>
              <button
                onClick={handleLike}
                className="btn btn-outline"
                style={{
                  flex: 1,
                  justifyContent: 'center',
                  borderColor: isLiked ? '#ec4899' : undefined,
                  background: isLiked ? 'rgba(236,72,153,0.15)' : undefined,
                }}
              >
                <Heart size={16} fill={isLiked ? '#ec4899' : 'none'} color={isLiked ? '#ec4899' : 'currentColor'} />
                <span>{isLiked ? '¡Voy a este carrete!' : 'Me Interesa / Voy'}</span>
                <span style={{ fontSize: '12px', opacity: 0.7 }}>({likesCount})</span>
              </button>

              <button
                onClick={handleShareWhatsApp}
                className="btn btn-outline"
                style={{
                  flex: 1,
                  justifyContent: 'center',
                  background: 'rgba(37,211,102,0.1)',
                  borderColor: 'rgba(37,211,102,0.3)',
                  color: '#4ade80',
                }}
              >
                <MessageCircle size={16} />
                <span>Mandar al Grupo de WhatsApp</span>
              </button>

              <button
                onClick={handleCopyLink}
                className="btn btn-ghost"
                title="Copiar link"
                style={{ padding: '10px 14px' }}
              >
                {copied ? <CheckCircle2 size={16} color="#10b981" /> : <Share2 size={16} />}
              </button>
            </div>
          </div>

          {/* Columna Derecha: Información del Carrete */}
          <div className="glass-card" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase' }}>
                  {evento.fecha}
                </span>
                <span style={{ color: 'var(--text-muted)' }}>•</span>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {evento.hora ? `${evento.hora} hrs` : '22:00 hrs'}
                </span>
              </div>
              <h1 style={{ fontSize: 'clamp(22px, 4vw, 32px)', lineHeight: 1.15 }}>{evento.nombre}</h1>
            </div>

            {/* Info Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              {/* Lugar */}
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <MapPin size={12} color="#ec4899" /> Lugar
                </div>
                <div style={{ fontWeight: 600, fontSize: '14px' }}>{evento.lugar}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {evento.sector ? `${evento.sector}, ` : ''}{evento.ciudad}
                </div>
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: '11px', color: '#a78bfa', display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}
                >
                  <Navigation size={11} /> Cómo llegar en Google Maps
                </a>
              </div>

              {/* Precio */}
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Ticket size={12} color="#f59e0b" /> Entrada
                </div>
                <div style={{ fontWeight: 700, fontSize: '16px', color: evento.precio === 0 ? '#10b981' : '#f59e0b' }}>
                  {evento.precio === 0 ? '🎉 ENTRADA LIBERADA' : `$${evento.precio.toLocaleString('es-CL')}`}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {evento.precio_texto || (evento.precio === 0 ? 'Acceso libre' : 'General')}
                </div>
              </div>
            </div>

            {/* Organizador */}
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '14px 18px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Instagram size={20} color="#ec4899" />
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Organizado por</div>
                  <div style={{ fontWeight: 600, fontSize: '14px' }}>{evento.organizador}</div>
                </div>
              </div>

              {evento.organizador_url && (
                <a
                  href={evento.organizador_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline btn-sm"
                >
                  <span>Ver Instagram</span>
                  <ExternalLink size={12} />
                </a>
              )}
            </div>

            {/* Descripción */}
            <div>
              <h3 style={{ fontSize: '15px', marginBottom: '8px', color: 'var(--text-secondary)' }}>Detalles del Carrete</h3>
              <p style={{ color: 'var(--text-primary)', fontSize: '14px', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
                {evento.descripcion || 'Sin descripción adicional. Consulta con el organizador en Instagram para más detalles sobre listas y promociones.'}
              </p>
            </div>

            {/* Link a Entradas / Post Oficial */}
            {evento.fuente_url && (
              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '16px' }}>
                <a
                  href={evento.fuente_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center', fontSize: '15px' }}
                >
                  <span>Ir al Link Oficial / Comprar Entradas</span>
                  <ExternalLink size={16} />
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Carretes Relacionados */}
        {related.length > 0 && (
          <div style={{ marginTop: '64px' }}>
            <h3 style={{ fontSize: '20px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={18} color="#ec4899" />
              <span>Otros Carretes que te Pueden Gustar</span>
            </h3>

            <div className="event-grid">
              {related.map((evt) => (
                <EventCard key={evt.id} evento={evt} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
