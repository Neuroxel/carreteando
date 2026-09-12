'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  MapPin,
  Calendar,
  Clock,
  Heart,
  Share2,
  ExternalLink,
  Instagram,
  CheckCircle2,
  Ticket,
} from 'lucide-react';
import { Evento, CATEGORIAS } from '../lib/types';
import { toggleRsvp, getUserRsvps } from '../lib/events-store';

interface EventCardProps {
  evento: Evento;
  onRsvpChange?: () => void;
}

export default function EventCard({ evento, onRsvpChange }: EventCardProps) {
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(evento.asistentes_interesados || 0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const userRsvps = getUserRsvps();
    setIsLiked(userRsvps.includes(evento.id));
  }, [evento.id]);

  const handleLike = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const res = toggleRsvp(evento.id);
    setIsLiked(res.interested);
    setLikesCount(res.count);
    if (onRsvpChange) onRsvpChange();
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/evento/${evento.id}` : '';
    if (navigator.share) {
      try {
        await navigator.share({
          title: evento.nombre,
          text: `¡Mira este carrete en ${evento.ciudad}: ${evento.nombre}!`,
          url: shareUrl,
        });
      } catch {
        // user dismissed
      }
    } else {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Formatear fecha amigable
  const formatDateFriendly = (dateStr: string) => {
    const today = new Date();
    const [y, m, d] = dateStr.split('-').map(Number);
    const eventDate = new Date(y, m - 1, d);

    const todayStr = today.toISOString().split('T')[0];
    const tmr = new Date(today);
    tmr.setDate(today.getDate() + 1);
    const tmrStr = tmr.toISOString().split('T')[0];

    if (dateStr === todayStr) return '🔥 HOY';
    if (dateStr === tmrStr) return '⚡ MAÑANA';

    const dayNames = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
    const monthNames = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
    return `${dayNames[eventDate.getDay()]} ${eventDate.getDate()} ${monthNames[eventDate.getMonth()]}`;
  };

  const catMeta = CATEGORIAS.find((c) => c.value === evento.categoria);

  return (
    <div className="event-card group">
      {/* Link envoltorio a la página de detalle */}
      <Link href={`/evento/${evento.id}`} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Imagen / Flyer */}
        <div className="event-card-image" style={{ position: 'relative' }}>
          <img
            src={
              evento.imagen_url ||
              'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=800&q=80'
            }
            alt={evento.nombre}
            loading="lazy"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transition: 'transform 0.4s ease',
            }}
          />
          <div className="event-card-image-overlay" />

          {/* Badges superiores */}
          <div className="event-card-top-badges">
            {/* Categoría */}
            <span className={`badge ${catMeta?.badgeClass || 'badge-otro'}`} style={{ backdropFilter: 'blur(8px)' }}>
              <span>{catMeta?.emoji}</span>
              <span>{catMeta?.label || evento.categoria}</span>
            </span>

            {/* Fecha destacada */}
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                background: 'rgba(0,0,0,0.7)',
                color: '#f8fafc',
                padding: '4px 8px',
                borderRadius: 'var(--radius-full)',
                border: '1px solid rgba(255,255,255,0.15)',
                backdropFilter: 'blur(8px)',
                letterSpacing: '0.04em',
              }}
            >
              {formatDateFriendly(evento.fecha)}
            </span>
          </div>

          {/* Botones de acción flotantes sobre flyer */}
          <div style={{ position: 'absolute', top: '12px', right: '12px', display: 'flex', gap: '6px', zIndex: 2 }}>
            <button
              onClick={handleShare}
              title="Compartir carrete"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'rgba(0,0,0,0.6)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: copied ? '#10b981' : '#f8fafc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
              }}
            >
              {copied ? <CheckCircle2 size={15} /> : <Share2 size={15} />}
            </button>
            <button
              onClick={handleLike}
              title="Me interesa este carrete"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: isLiked ? 'rgba(236,72,153,0.9)' : 'rgba(0,0,0,0.6)',
                backdropFilter: 'blur(8px)',
                border: isLiked ? '1px solid #ec4899' : '1px solid rgba(255,255,255,0.15)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
              }}
            >
              <Heart size={15} fill={isLiked ? '#fff' : 'none'} />
            </button>
          </div>
        </div>

        {/* Cuerpo de la tarjeta */}
        <div className="event-card-body">
          {/* Horario y Comuna */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#a78bfa', fontWeight: 600 }}>
              <Clock size={13} />
              <span>{evento.hora ? `${evento.hora} hrs` : '22:00 hrs'}</span>
            </span>
            <span
              style={{
                fontSize: '11px',
                color: 'var(--text-secondary)',
                background: 'rgba(255,255,255,0.06)',
                padding: '2px 8px',
                borderRadius: '10px',
              }}
            >
              {evento.ciudad}
            </span>
          </div>

          {/* Título */}
          <h3 className="event-card-title">{evento.nombre}</h3>

          {/* Ubicación y Sector */}
          <div className="event-card-location">
            <MapPin size={14} style={{ color: '#ec4899', flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {evento.lugar} {evento.sector ? `· ${evento.sector}` : ''}
            </span>
          </div>

          {/* Precio y Condiciones */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
            {evento.precio === 0 ? (
              <span className="badge badge-free" style={{ fontSize: '11px', padding: '3px 8px' }}>
                🎉 GRATIS
              </span>
            ) : (
              <span className="badge badge-paid" style={{ fontSize: '11px', padding: '3px 8px' }}>
                ${evento.precio.toLocaleString('es-CL')}
              </span>
            )}
            {evento.precio_texto && (
              <span
                style={{
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {evento.precio_texto}
              </span>
            )}
          </div>

          {/* Footer de la tarjeta */}
          <div className="event-card-footer">
            {/* Organizador */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {evento.fuente === 'instagram' ? (
                <Instagram size={13} style={{ color: '#ec4899' }} />
              ) : evento.fuente === 'passline' ? (
                <Ticket size={13} style={{ color: '#f59e0b' }} />
              ) : (
                <CheckCircle2 size={13} style={{ color: '#10b981' }} />
              )}
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                }}
              >
                {evento.organizador || '@eventosvalpo'}
              </span>
            </div>

            {/* Contador de interesados */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
              <Heart size={12} fill={isLiked ? '#ec4899' : 'currentColor'} style={{ color: isLiked ? '#ec4899' : undefined }} />
              <span>{likesCount} van</span>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}
