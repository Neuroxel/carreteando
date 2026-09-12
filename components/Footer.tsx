import React from 'react';
import Link from 'next/link';
import { Sparkles, Instagram, Heart, PlusCircle, Radio, MapPin } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-inner">
          {/* Columna Izquierda */}
          <div style={{ maxWidth: '380px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  background: 'var(--gradient-brand)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Sparkles size={16} color="#fff" />
              </div>
              <span style={{ fontWeight: 800, fontSize: '18px', letterSpacing: '-0.02em' }}>
                CARRETES <span className="text-gradient">V REGIÓN</span>
              </span>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Centralizando el carrete porteño y viñamarino. La cartelera abierta de fiestas universitarias, raves under, tocatas porteñas y noches de la costa.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '14px' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '11px',
                  color: '#10b981',
                  background: 'rgba(16,185,129,0.1)',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-full)',
                  border: '1px solid rgba(16,185,129,0.3)',
                }}
              >
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                Radar Instagram en vivo
              </span>
            </div>
          </div>

          {/* Links Rápidos */}
          <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
            <div>
              <h4 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '12px' }}>
                Explorar
              </h4>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                <li>
                  <Link href="/buscar?categoria=universitario" style={{ color: 'var(--text-secondary)' }}>
                    🎓 Mechoneos & Universitarios
                  </Link>
                </li>
                <li>
                  <Link href="/buscar?categoria=under" style={{ color: 'var(--text-secondary)' }}>
                    🌙 Fiestas Under & Raves
                  </Link>
                </li>
                <li>
                  <Link href="/buscar?categoria=electronica" style={{ color: 'var(--text-secondary)' }}>
                    🎧 Electrónica & Techno
                  </Link>
                </li>
                <li>
                  <Link href="/buscar?categoria=cumbia" style={{ color: 'var(--text-secondary)' }}>
                    🪗 Cumbia Porteña
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '12px' }}>
                Comunidad
              </h4>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                <li>
                  <Link href="/publicar" style={{ color: '#a78bfa', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <PlusCircle size={13} /> Publicar Evento Gratis
                  </Link>
                </li>
                <li>
                  <Link href="/radar" style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Radio size={13} /> Radar Instagram
                  </Link>
                </li>
                <li>
                  <Link href="/mapa" style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <MapPin size={13} /> Mapa de Hotspots
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="divider" style={{ margin: '24px 0 16px' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
          <span>
            Hecho con ❤️ para la juventud de Valparaíso, Viña del Mar, Reñaca y Quilpué.
          </span>
          <span>
            carretes.vercel.app · Conectado con Instagram & Passline
          </span>
        </div>
      </div>
    </footer>
  );
}
