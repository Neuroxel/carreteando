'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  PlusCircle,
  Sparkles,
  Calendar,
  Clock,
  MapPin,
  Tag,
  DollarSign,
  Instagram,
  CheckCircle2,
  ArrowLeft,
  Image as ImageIcon,
} from 'lucide-react';
import { Categoria, CATEGORIAS, CIUDADES, EventoFormData } from '../../lib/types';
import { saveEvent } from '../../lib/events-store';

const PRESET_FLYERS = [
  { label: 'Fiesta & Luces', url: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Rave & Techno', url: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Cumbia & Terremoto', url: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Tocata en Vivo', url: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Previa de Bar', url: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Beach Sunset', url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80' },
];

export default function PublicarPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<EventoFormData>({
    nombre: '',
    descripcion: '',
    fecha: new Date().toISOString().split('T')[0],
    hora: '22:00',
    lugar: '',
    ciudad: 'Valparaíso',
    sector: '',
    precio: '',
    precio_texto: '',
    categoria: 'universitario',
    organizador: '@',
    organizador_url: '',
    fuente_url: '',
    imagen_url: PRESET_FLYERS[0].url,
    tags: '',
  });

  const [submittedId, setSubmittedId] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nombre.trim() || !formData.lugar.trim() || !formData.fecha) {
      alert('Por favor completa los campos requeridos (*)');
      return;
    }

    const created = saveEvent({
      ...formData,
      precio: formData.precio === '' ? 0 : Number(formData.precio),
    });

    setSubmittedId(created.id);
  };

  return (
    <div style={{ padding: '40px 0 80px' }}>
      <div className="container">
        {/* Back Link */}
        <Link
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            color: 'var(--text-secondary)',
            marginBottom: '24px',
          }}
        >
          <ArrowLeft size={16} />
          <span>Volver a la cartelera</span>
        </Link>

        {submittedId ? (
          <div className="glass-card" style={{ maxWidth: '600px', margin: '0 auto', padding: '48px 32px', textAlign: 'center' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(16,185,129,0.2)',
                border: '1px solid #10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
                color: '#10b981',
              }}
            >
              <CheckCircle2 size={36} />
            </div>

            <h2 style={{ fontSize: '28px', marginBottom: '12px' }}>¡Carrete Publicado con Éxito!</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '15px', marginBottom: '28px', lineHeight: 1.6 }}>
              Tu evento ya está en la cartelera principal de <strong>Carretes V Región</strong> para que todos los jóvenes y universitarios puedan encontrarlo.
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <Link href={`/evento/${submittedId}`} className="btn btn-primary">
                Ver Mi Evento
              </Link>
              <Link href="/" className="btn btn-outline">
                Ir a la Portada
              </Link>
              <button
                onClick={() => {
                  setSubmittedId(null);
                  setFormData({
                    nombre: '',
                    descripcion: '',
                    fecha: new Date().toISOString().split('T')[0],
                    hora: '22:00',
                    lugar: '',
                    ciudad: 'Valparaíso',
                    sector: '',
                    precio: '',
                    precio_texto: '',
                    categoria: 'universitario',
                    organizador: '@',
                    organizador_url: '',
                    fuente_url: '',
                    imagen_url: PRESET_FLYERS[0].url,
                    tags: '',
                  });
                }}
                className="btn btn-ghost"
              >
                Publicar Otro
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '40px', alignItems: 'start' }}>
            {/* Columna Izquierda: Formulario */}
            <div>
              <div style={{ marginBottom: '24px' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: '#a78bfa',
                    letterSpacing: '0.05em',
                  }}
                >
                  Envío Abierto a la Comunidad
                </span>
                <h1 style={{ fontSize: 'clamp(26px, 4vw, 36px)', marginTop: '4px' }}>
                  Publicar Carrete o Flyer
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '6px' }}>
                  Totalmente gratis. Centros de estudiantes, productoras, locales y tocatas under.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="glass-card" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {/* Nombre */}
                <div className="form-group">
                  <label className="form-label">Nombre del Carrete / Evento *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="Ej: Gran Mechoneo 3 Pisos en El Huevo / Rave Secreta"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  />
                </div>

                {/* Categoría & Ciudad */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">Categoría *</label>
                    <select
                      className="form-select"
                      value={formData.categoria}
                      onChange={(e) => setFormData({ ...formData, categoria: e.target.value as Categoria })}
                    >
                      {CATEGORIAS.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.emoji} {c.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Comuna *</label>
                    <select
                      className="form-select"
                      value={formData.ciudad}
                      onChange={(e) => setFormData({ ...formData, ciudad: e.target.value })}
                    >
                      {CIUDADES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Lugar & Sector */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">Lugar / Local / Dirección *</label>
                    <input
                      type="text"
                      required
                      className="form-input"
                      placeholder="Ej: El Huevo (Blanco #1386) o 'Secreto Barrio Puerto'"
                      value={formData.lugar}
                      onChange={(e) => setFormData({ ...formData, lugar: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Sector / Barrio</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Ej: Subida Ecuador, Reñaca"
                      value={formData.sector || ''}
                      onChange={(e) => setFormData({ ...formData, sector: e.target.value })}
                    />
                  </div>
                </div>

                {/* Fecha & Hora */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">Fecha *</label>
                    <input
                      type="date"
                      required
                      className="form-input"
                      value={formData.fecha}
                      onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Hora de Inicio</label>
                    <input
                      type="time"
                      className="form-input"
                      value={formData.hora}
                      onChange={(e) => setFormData({ ...formData, hora: e.target.value })}
                    />
                  </div>
                </div>

                {/* Precio & Condiciones */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">Precio ($ CLP - 0 para Gratis)</label>
                    <input
                      type="number"
                      min="0"
                      step="500"
                      className="form-input"
                      placeholder="0 (gratis) o ej: 4000"
                      value={formData.precio}
                      onChange={(e) => setFormData({ ...formData, precio: e.target.value === '' ? '' : Number(e.target.value) })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Detalle Entrada / Lista</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Ej: Gratis en lista hasta 00:30, luego $4.000"
                      value={formData.precio_texto || ''}
                      onChange={(e) => setFormData({ ...formData, precio_texto: e.target.value })}
                    />
                  </div>
                </div>

                {/* Organizador & Link IG */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">Instagram del Organizador *</label>
                    <input
                      type="text"
                      required
                      className="form-input"
                      placeholder="@elhuevovalpo o @feuv"
                      value={formData.organizador}
                      onChange={(e) => setFormData({ ...formData, organizador: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Link de Venta / IG / WhatsApp</label>
                    <input
                      type="url"
                      className="form-input"
                      placeholder="https://instagram.com/... o passline.com/..."
                      value={formData.fuente_url || ''}
                      onChange={(e) => setFormData({ ...formData, fuente_url: e.target.value })}
                    />
                  </div>
                </div>

                {/* Imagen / Flyer */}
                <div className="form-group">
                  <label className="form-label">Imagen / Flyer (URL o elegir estilo)</label>
                  <input
                    type="url"
                    className="form-input"
                    placeholder="https://... URL de tu imagen o flyer"
                    value={formData.imagen_url || ''}
                    onChange={(e) => setFormData({ ...formData, imagen_url: e.target.value })}
                  />

                  {/* Flyer Presets */}
                  <div style={{ marginTop: '8px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>O selecciona una temática:</span>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                      {PRESET_FLYERS.map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => setFormData({ ...formData, imagen_url: preset.url })}
                          style={{
                            fontSize: '11px',
                            padding: '3px 8px',
                            borderRadius: 'var(--radius-full)',
                            background: formData.imagen_url === preset.url ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.04)',
                            border: formData.imagen_url === preset.url ? '1px solid #a78bfa' : '1px solid var(--color-border)',
                            color: formData.imagen_url === preset.url ? '#a78bfa' : 'var(--text-secondary)',
                            cursor: 'pointer',
                          }}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Descripción */}
                <div className="form-group">
                  <label className="form-label">Descripción & Lineup</label>
                  <textarea
                    className="form-textarea"
                    placeholder="Cuéntale a la gente qué habrá: DJs, tragos en promo, tipo de música, cómo entrar..."
                    value={formData.descripcion}
                    onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  />
                </div>

                {/* Submit button */}
                <button type="submit" className="btn btn-primary btn-lg" style={{ justifyContent: 'center', marginTop: '8px' }}>
                  <PlusCircle size={18} />
                  <span>Publicar en la Cartelera Ahora</span>
                </button>
              </form>
            </div>

            {/* Columna Derecha: Vista Previa en Vivo del Flyer */}
            <div style={{ position: 'sticky', top: '88px' }}>
              <div style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={16} color="#a78bfa" />
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase' }}>
                  Vista Previa en Vivo
                </span>
              </div>

              {/* Flyer Preview Card */}
              <div className="glass-card" style={{ overflow: 'hidden', maxWidth: '380px', margin: '0 auto' }}>
                <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', overflow: 'hidden' }}>
                  <img
                    src={formData.imagen_url || PRESET_FLYERS[0].url}
                    alt="Preview"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <div className="event-card-image-overlay" />
                  <div style={{ position: 'absolute', top: '10px', left: '10px', display: 'flex', gap: '6px' }}>
                    <span className="badge badge-universitario" style={{ fontSize: '10px' }}>
                      {formData.categoria}
                    </span>
                    <span style={{ fontSize: '10px', background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '3px 8px', borderRadius: '10px', fontWeight: 700 }}>
                      {formData.fecha || 'FECHA'}
                    </span>
                  </div>
                </div>

                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '11px', color: '#a78bfa', fontWeight: 600 }}>
                    {formData.hora || '22:00'} hrs · {formData.ciudad}
                  </div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, lineHeight: 1.2 }}>
                    {formData.nombre || 'Nombre de tu Carrete'}
                  </h3>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <MapPin size={12} color="#ec4899" />
                    <span>{formData.lugar || 'Ubicación / Local'}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                    {formData.precio === 0 || formData.precio === '' ? (
                      <span className="badge badge-free" style={{ fontSize: '10px' }}>GRATIS</span>
                    ) : (
                      <span className="badge badge-paid" style={{ fontSize: '10px' }}>
                        ${Number(formData.precio).toLocaleString('es-CL')}
                      </span>
                    )}
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {formData.precio_texto || 'Entrada general'}
                    </span>
                  </div>

                  <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '10px', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                    <Instagram size={12} color="#ec4899" />
                    <span>{formData.organizador || '@tu_cuenta'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
