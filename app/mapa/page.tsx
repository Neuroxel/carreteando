'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { MapPin, Navigation, Sparkles, ArrowRight, ExternalLink } from 'lucide-react';
import { Evento, HOTSPOTS_COORDENADAS } from '../../lib/types';
import { getStoredEvents } from '../../lib/events-store';
import EventCard from '../../components/EventCard';

export default function MapaPage() {
  const [events, setEvents] = useState<Evento[]>([]);
  const [selectedHotspot, setSelectedHotspot] = useState<string | null>(null);

  useEffect(() => {
    setEvents(getStoredEvents());
  }, []);

  const hotspots = Object.entries(HOTSPOTS_COORDENADAS).map(([name, data]) => {
    const matchingEvents = events.filter((e) => {
      const nLower = name.toLowerCase();
      const placeMatch = e.lugar?.toLowerCase().includes(nLower.split(',')[0].toLowerCase()) ||
        e.sector?.toLowerCase().includes(nLower.split(',')[0].toLowerCase()) ||
        (name.includes('Ecuador') && (e.lugar?.toLowerCase().includes('ecuador') || e.sector?.toLowerCase().includes('ecuador'))) ||
        (name.includes('Barón') && (e.lugar?.toLowerCase().includes('barón') || e.lugar?.toLowerCase().includes('baron'))) ||
        (name.includes('Puerto') && (e.lugar?.toLowerCase().includes('puerto') || e.sector?.toLowerCase().includes('puerto'))) ||
        (name.includes('Reñaca') && e.ciudad.toLowerCase().includes('reñaca')) ||
        (name.includes('Quilpué') && e.ciudad.toLowerCase().includes('quilpué'));
      return placeMatch;
    });

    return {
      name,
      ...data,
      count: matchingEvents.length,
      events: matchingEvents,
    };
  });

  const activeHotspotData = hotspots.find((h) => h.name === selectedHotspot) || hotspots[0];

  return (
    <div style={{ padding: '32px 0 80px' }}>
      <div className="container">
        {/* Header */}
        <div style={{ marginBottom: '28px', textAlign: 'center', maxWidth: '680px', margin: '0 auto 28px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: 700,
              color: '#ec4899',
              background: 'rgba(236,72,153,0.15)',
              padding: '4px 12px',
              borderRadius: 'var(--radius-full)',
              marginBottom: '12px',
            }}
          >
            <MapPin size={14} />
            <span>RADAR GEOGRÁFICO DE LA BOHEMIA</span>
          </div>
          <h1 style={{ fontSize: 'clamp(26px, 5vw, 40px)', marginBottom: '10px' }}>
            Mapa de Hotspots <span className="text-gradient">V Región</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
            Descubre dónde se concentran las fiestas hoy: desde las noches interminables de Subida Ecuador hasta los sunsets en las arenas de Reñaca.
          </p>
        </div>

        {/* Hotspots Grid Buttons */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '12px',
            marginBottom: '32px',
          }}
        >
          {hotspots.map((h) => {
            const isSelected = activeHotspotData?.name === h.name;
            return (
              <button
                key={h.name}
                onClick={() => setSelectedHotspot(h.name)}
                className="glass-card"
                style={{
                  padding: '16px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  borderColor: isSelected ? '#a78bfa' : undefined,
                  background: isSelected ? 'rgba(124,58,237,0.2)' : undefined,
                  boxShadow: isSelected ? '0 0 20px rgba(124,58,237,0.3)' : undefined,
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <MapPin size={16} color={isSelected ? '#ec4899' : '#a78bfa'} />
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '10px',
                      background: h.count > 0 ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.06)',
                      color: h.count > 0 ? '#6ee7b7' : 'var(--text-muted)',
                    }}
                  >
                    {h.count} {h.count === 1 ? 'carrete' : 'carretes'}
                  </span>
                </div>
                <div style={{ fontWeight: 700, fontSize: '14px', color: '#f8fafc' }}>{h.name}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.4 }}>
                  {h.descripcion}
                </div>
              </button>
            );
          })}
        </div>

        {/* Active Hotspot Banner with Google Maps Link */}
        {activeHotspotData && (
          <div
            className="glass-card"
            style={{
              padding: '24px',
              marginBottom: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              flexWrap: 'wrap',
              background: 'linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(236,72,153,0.1) 100%)',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 700 }}>{activeHotspotData.name}</h2>
                <span className="badge badge-universitario" style={{ fontSize: '11px' }}>
                  Zona Activa
                </span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '4px 0 0' }}>
                {activeHotspotData.descripcion}
              </p>
            </div>

            <a
              href={`https://www.google.com/maps/search/?api=1&query=${activeHotspotData.lat},${activeHotspotData.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline btn-sm"
            >
              <Navigation size={14} />
              <span>Abrir zona en Google Maps</span>
              <ExternalLink size={12} />
            </a>
          </div>
        )}

        {/* Events in Selected Hotspot */}
        <div>
          <h3 style={{ fontSize: '18px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={16} color="#a78bfa" />
            <span>Carretes en {activeHotspotData?.name}</span>
          </h3>

          {activeHotspotData?.events && activeHotspotData.events.length > 0 ? (
            <div className="event-grid">
              {activeHotspotData.events.map((evt) => (
                <EventCard key={evt.id} evento={evt} />
              ))}
            </div>
          ) : (
            <div className="empty-state glass-card" style={{ padding: '40px 20px' }}>
              <p style={{ color: 'var(--text-secondary)' }}>
                No hay eventos programados en este momento para este sector específico.
              </p>
              <Link href="/publicar" className="btn btn-primary btn-sm" style={{ marginTop: '12px' }}>
                ¿Tienes un carrete aquí? Publícalo gratis
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
