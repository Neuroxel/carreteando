'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Radio,
  Instagram,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  ExternalLink,
  ArrowRight,
  Zap,
  PlusCircle,
  AlertCircle,
  Eye,
} from 'lucide-react';
import { MONITORED_IG_ACCOUNTS, parseInstagramCaption, ParsedEventCandidate } from '../../lib/scraper-engine';
import { saveEvent } from '../../lib/events-store';

export default function RadarPage() {
  const [isScanning, setIsScanning] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [scanMessage, setScanMessage] = useState('');

  // Formulario de importación de IG
  const [igUrl, setIgUrl] = useState('');
  const [igHandle, setIgHandle] = useState('@');
  const [igCaption, setIgCaption] = useState('');
  const [igImage, setIgImage] = useState('');
  const [preview, setPreview] = useState<ParsedEventCandidate | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);

  // Escanear radar
  const handleScanRadar = () => {
    setIsScanning(true);
    setScanSuccess(false);
    setScanMessage('Conectando con la API de Instagram & scraping de hashtags #valparaiso #carretevalpo #mechoneo...');

    setTimeout(() => {
      setScanMessage('Extrayendo entidades con LLM (fecha, lugar, precio, categoría)...');
    }, 1200);

    setTimeout(() => {
      // Agregar un nuevo evento detectado por el radar
      const newScraped = parseInstagramCaption(
        `🚨 NUEVO CARRETE DETECTADO 🚨\nSÁBADO 15 DE MARZO - UNIVERSITARIO VALPO NIGHT\n📍 Bar La Pasada (Subida Ecuador #182)\nEntrada Liberada hasta las 00:30 anotándose en los comentarios! Luego $3.000 con cover.\nLineup: DJ Porteño + Reggaeton 2000s y Pop. No te quedes afuera! #valparaiso #subidaecuador #carrete`,
        '@valponight_oficial',
        'https://instagram.com/valponight_oficial',
        'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80'
      );

      saveEvent({
        nombre: newScraped.nombre,
        descripcion: newScraped.descripcion,
        fecha: newScraped.fecha,
        hora: newScraped.hora,
        lugar: newScraped.lugar,
        ciudad: newScraped.ciudad,
        precio: newScraped.precio,
        precio_texto: newScraped.precio_texto,
        categoria: newScraped.categoria,
        organizador: newScraped.organizador,
        fuente_url: newScraped.fuente_url,
        imagen_url: newScraped.imagen_url,
        tags: newScraped.tags.join(','),
      });

      setIsScanning(false);
      setScanSuccess(true);
      setScanMessage('¡Radar completado! 1 nuevo carrete detectado y añadido automáticamente a la cartelera.');
    }, 2800);
  };

  // Previsualizar caption
  const handleAnalyzeCaption = (e: React.FormEvent) => {
    e.preventDefault();
    if (!igCaption.trim()) return;

    const parsed = parseInstagramCaption(
      igCaption,
      igHandle.trim() || '@organizador',
      igUrl.trim() || 'https://instagram.com',
      igImage.trim() || undefined
    );
    setPreview(parsed);
  };

  // Guardar evento importado
  const handleSaveImported = () => {
    if (!preview) return;

    saveEvent({
      nombre: preview.nombre,
      descripcion: preview.descripcion,
      fecha: preview.fecha,
      hora: preview.hora,
      lugar: preview.lugar,
      ciudad: preview.ciudad,
      precio: preview.precio,
      precio_texto: preview.precio_texto,
      categoria: preview.categoria,
      organizador: preview.organizador,
      fuente_url: preview.fuente_url,
      imagen_url: preview.imagen_url,
      tags: preview.tags.join(','),
    });

    setImportSuccess(true);
    setPreview(null);
    setIgCaption('');
    setIgUrl('');
    setIgHandle('@');
    setIgImage('');

    setTimeout(() => {
      setImportSuccess(false);
    }, 4000);
  };

  return (
    <div style={{ padding: '40px 0 80px' }}>
      <div className="container">
        {/* Header */}
        <div style={{ textAlign: 'center', maxWidth: '720px', margin: '0 auto 40px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: 700,
              color: '#ec4899',
              background: 'rgba(236,72,153,0.15)',
              border: '1px solid rgba(236,72,153,0.3)',
              padding: '4px 12px',
              borderRadius: 'var(--radius-full)',
              marginBottom: '16px',
            }}
          >
            <Radio size={14} className="animate-pulse" />
            <span>MOTOR DE RECOPILACIÓN AUTOMÁTICA</span>
          </div>

          <h1 style={{ fontSize: 'clamp(28px, 5vw, 48px)', marginBottom: '16px' }}>
            Radar de Instagram <span className="text-gradient">V Región</span>
          </h1>

          <p style={{ color: 'var(--text-secondary)', fontSize: '16px', lineHeight: 1.6 }}>
            Monitoreamos continuamente las cuentas de Instagram de las discotecas, locales bohemios, colectivos under y centros de alumnos de Valparaíso, Viña del Mar y Marga Marga.
          </p>

          <div style={{ marginTop: '24px' }}>
            <button
              onClick={handleScanRadar}
              disabled={isScanning}
              className="btn btn-primary btn-lg"
              style={{ boxShadow: '0 0 25px rgba(236,72,153,0.4)' }}
            >
              <RefreshCw size={18} className={isScanning ? 'animate-spin' : ''} />
              <span>{isScanning ? 'Escaneando Instagram en vivo...' : 'Escanear Radar Ahora'}</span>
            </button>
          </div>

          {/* Mensajes de escaneo */}
          {scanMessage && (
            <div
              style={{
                marginTop: '16px',
                padding: '12px 18px',
                borderRadius: '12px',
                background: scanSuccess ? 'rgba(16,185,129,0.15)' : 'rgba(124,58,237,0.15)',
                border: `1px solid ${scanSuccess ? 'rgba(16,185,129,0.3)' : 'rgba(124,58,237,0.3)'}`,
                color: scanSuccess ? '#6ee7b7' : '#c4b5fd',
                fontSize: '13px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {scanSuccess ? <CheckCircle2 size={16} /> : <Radio size={16} className="animate-pulse" />}
              <span>{scanMessage}</span>
              {scanSuccess && (
                <Link href="/" style={{ color: '#fff', textDecoration: 'underline', fontWeight: 600, marginLeft: '6px' }}>
                  Ver en Cartelera →
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Dos Columnas: Cuentas Monitoreadas vs Importador Rápido */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '32px' }}>
          {/* Columna 1: Cuentas Monitoreadas */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Instagram size={18} color="#ec4899" />
                  <span>Cuentas Bajo Vigilancia</span>
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                  Perfiles clave que el scraper monitorea cada 6 horas
                </p>
              </div>
              <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.06)', padding: '3px 8px', borderRadius: '10px', color: 'var(--text-muted)' }}>
                {MONITORED_IG_ACCOUNTS.length} fuentes
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {MONITORED_IG_ACCOUNTS.map((acc) => (
                <div
                  key={acc.handle}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img
                      src={acc.avatar}
                      alt={acc.nombre}
                      style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>{acc.nombre}</span>
                        <span style={{ fontSize: '10px', color: '#a78bfa', background: 'rgba(124,58,237,0.2)', padding: '1px 5px', borderRadius: '6px' }}>
                          {acc.ciudad}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {acc.handle} · {acc.seguidores} seguidores
                      </div>
                    </div>
                  </div>

                  <a
                    href={`https://instagram.com/${acc.handle.replace('@', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost btn-sm"
                    title="Ver perfil en Instagram"
                  >
                    <ExternalLink size={14} />
                  </a>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '20px', padding: '12px', borderRadius: '10px', background: 'rgba(236,72,153,0.08)', border: '1px dashed rgba(236,72,153,0.3)', textAlign: 'center' }}>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                ¿Tienes una cuenta de Instagram de fiestas o centro de alumnos?
              </p>
              <Link href="/publicar" style={{ fontSize: '12px', color: '#ec4899', fontWeight: 600, textDecoration: 'underline' }}>
                Sugiere una cuenta o publica tu flyer directamente →
              </Link>
            </div>
          </div>

          {/* Columna 2: Importador con Parser Inteligente */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} color="#f59e0b" />
                <span>Importador Inteligente de Flyers</span>
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                Pega el texto de cualquier post o historia de Instagram y el modelo extraerá los datos automáticamente
              </p>
            </div>

            {importSuccess && (
              <div
                style={{
                  padding: '14px',
                  borderRadius: '12px',
                  background: 'rgba(16,185,129,0.15)',
                  border: '1px solid rgba(16,185,129,0.3)',
                  color: '#6ee7b7',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13px',
                }}
              >
                <CheckCircle2 size={16} />
                <span>¡Evento procesado y añadido a la cartelera pública!</span>
              </div>
            )}

            <form onSubmit={handleAnalyzeCaption} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Cuenta de Instagram</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="@nombre_cuenta"
                    value={igHandle}
                    onChange={(e) => setIgHandle(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Link del Post (opcional)</label>
                  <input
                    type="url"
                    className="form-input"
                    placeholder="https://instagram.com/p/..."
                    value={igUrl}
                    onChange={(e) => setIgUrl(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">URL de Imagen / Flyer (opcional)</label>
                <input
                  type="url"
                  className="form-input"
                  placeholder="https://... (link del flyer)"
                  value={igImage}
                  onChange={(e) => setIgImage(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Texto / Caption del Flyer *</label>
                <textarea
                  className="form-textarea"
                  placeholder="Pega aquí el texto que viene en el post o flyer (ej: ¡ESTE VIERNES 14! Gran carrete en El Huevo, preventa $4.000 con cover, entrada liberada hasta las 23:30...)"
                  value={igCaption}
                  onChange={(e) => setIgCaption(e.target.value)}
                  style={{ minHeight: '130px' }}
                  required
                />
              </div>

              <button type="submit" className="btn btn-outline" style={{ justifyContent: 'center' }}>
                <Zap size={16} color="#f59e0b" />
                <span>Analizar y Extraer Datos con IA</span>
              </button>
            </form>

            {/* Resultado de la extracción */}
            {preview && (
              <div
                style={{
                  marginTop: '20px',
                  padding: '16px',
                  borderRadius: '12px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(124,58,237,0.3)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase' }}>
                    ✨ Extracción Exitosa
                  </span>
                  <span className="badge badge-universitario" style={{ fontSize: '10px' }}>
                    {preview.categoria}
                  </span>
                </div>

                <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '6px' }}>{preview.nombre}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div>📅 Fecha: <strong>{preview.fecha}</strong> a las <strong>{preview.hora} hrs</strong></div>
                  <div>📍 Lugar: <strong>{preview.lugar} ({preview.ciudad})</strong></div>
                  <div>💵 Precio: <strong>{preview.precio === 0 ? 'Gratis' : `$${preview.precio}`}</strong> ({preview.precio_texto})</div>
                  <div>👤 Organizador: <strong>{preview.organizador}</strong></div>
                </div>

                <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
                  <button onClick={handleSaveImported} className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
                    <PlusCircle size={14} />
                    <span>Publicar en la Cartelera</span>
                  </button>
                  <button onClick={() => setPreview(null)} className="btn btn-ghost btn-sm">
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
