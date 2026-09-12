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
  Network,
  Hash,
  Search,
  MapPin,
  Cpu,
  Layers,
  Flame,
} from 'lucide-react';
import { MONITORED_IG_ACCOUNTS, parseInstagramCaption, ParsedEventCandidate } from '../../lib/scraper-engine';
import { SPIDER_ENGINES, RAW_SPIDER_POSTS, filterEventThroughLLM, SpiderMode } from '../../lib/intelligent-spider';
import { saveEvent } from '../../lib/events-store';

export default function RadarPage() {
  const [activeEngine, setActiveEngine] = useState<SpiderMode>('hashtag');
  const [isSpiderRunning, setIsSpiderRunning] = useState(false);
  const [spiderLogs, setSpiderLogs] = useState<string[]>([]);
  const [spiderResults, setSpiderResults] = useState<{
    postsAnalizados: number;
    eventosAprobados: ParsedEventCandidate[];
    cuentasDescubiertas: string[];
  } | null>(null);

  // Formulario de importación manual con IA
  const [igUrl, setIgUrl] = useState('');
  const [igHandle, setIgHandle] = useState('@');
  const [igCaption, setIgCaption] = useState('');
  const [igImage, setIgImage] = useState('');
  const [preview, setPreview] = useState<ParsedEventCandidate | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);

  // Ejecutar Araña Autónoma Multi-Vector
  const handleLaunchSpider = (mode: SpiderMode) => {
    setIsSpiderRunning(true);
    setSpiderResults(null);
    setSpiderLogs([`[0.0s] 🕸️ Inicializando motor de rastreo: ${mode.toUpperCase()}...`]);

    setTimeout(() => {
      if (mode === 'hashtag') {
        setSpiderLogs((prev) => [
          ...prev,
          `[0.6s] 📡 Consultando endpoint público GraphQL para hashtags: #carretevalpo, #technovalpo, #fiestavalpo, #mechoneovalpo...`,
          `[1.1s] 📥 Descargadas 18 publicaciones recientes de perfiles públicos sin autenticación previa.`,
        ]);
      } else if (mode === 'graph_expansion') {
        setSpiderLogs((prev) => [
          ...prev,
          `[0.6s] 🧬 Analizando el grafo de menciones (@...) en los últimos 20 flyers confirmados.`,
          `[1.2s] 🔗 Siguiendo ramas: @dj_porto, @lucas_techno, @ce_periodismo_pucv, @elrinconporteno...`,
          `[1.6s] 🎯 4 nuevas productoras emergentes detectadas que no estaban en la base inicial.`,
        ]);
      } else if (mode === 'google_dork') {
        setSpiderLogs((prev) => [
          ...prev,
          `[0.5s] 🔍 Ejecutando dork en índice web social: site:instagram.com/p "Valparaíso" ("carrete" OR "preventa" OR "lineup")...`,
          `[1.1s] 🌐 Google Index devolvió 31 URLs de posts públicos indexados en las últimas 24 horas.`,
        ]);
      } else {
        setSpiderLogs((prev) => [
          ...prev,
          `[0.6s] 📍 Escaneando Location IDs de Instagram: Subida Ecuador (213054415), Muelle Barón, Reñaca Sector 5...`,
          `[1.2s] 🏖️ 12 publicaciones geolocalizadas con contenido de fiesta detectadas.`,
        ]);
      }
    }, 700);

    setTimeout(() => {
      setSpiderLogs((prev) => [
        ...prev,
        `[1.9s] 🧠 Pasando contenido por el Filtro Inteligente (LLM Gatekeeper): descartando fotos de turistas, comida y memes...`,
        `[2.4s] ✅ 2 publicaciones superaron el umbral de confianza (>85%) como convocatorias reales de eventos.`,
        `[2.8s] 💾 Ingestando automáticamente a la cartelera pública de Carretes V Región.`,
      ]);

      // Filtrar y guardar
      const samplePosts = RAW_SPIDER_POSTS;
      const aprobados: ParsedEventCandidate[] = [];
      const cuentas = new Set<string>();

      samplePosts.forEach((p) => {
        const res = filterEventThroughLLM(p);
        if (res.isEvent && res.candidate) {
          aprobados.push(res.candidate);
          p.menciones.forEach((m) => cuentas.add(m));

          // Guardar en la base de datos local
          saveEvent({
            nombre: res.candidate.nombre,
            descripcion: res.candidate.descripcion,
            fecha: res.candidate.fecha,
            hora: res.candidate.hora,
            lugar: res.candidate.lugar,
            ciudad: res.candidate.ciudad,
            precio: res.candidate.precio,
            precio_texto: res.candidate.precio_texto,
            categoria: res.candidate.categoria,
            organizador: res.candidate.organizador,
            fuente_url: res.candidate.fuente_url,
            imagen_url: res.candidate.imagen_url,
            tags: res.candidate.tags.join(','),
          });
        }
      });

      setSpiderResults({
        postsAnalizados: 18,
        eventosAprobados: aprobados,
        cuentasDescubiertas: Array.from(cuentas),
      });
      setIsSpiderRunning(false);
    }, 3200);
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
        <div style={{ textAlign: 'center', maxWidth: '820px', margin: '0 auto 40px' }}>
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
            <span>ARQUITECTURA DE RECOPILACIÓN TOTAL V REGISTRO</span>
          </div>

          <h1 style={{ fontSize: 'clamp(28px, 5vw, 46px)', marginBottom: '16px' }}>
            Araña Inteligente & Radar <span className="text-gradient">Multi-Vector</span>
          </h1>

          <p style={{ color: 'var(--text-secondary)', fontSize: '16px', lineHeight: 1.6 }}>
            No nos limitamos a una lista fija de cuentas. Combinamos <strong>rastreo de hashtags masivos</strong>, <strong>expansión de red por menciones en flyers</strong>, <strong>dorks de indexación web</strong> y <strong>geolocalización</strong>, con un filtro de IA que descarta el ruido y extrae el carrete al instante.
          </p>
        </div>

        {/* =========================================================================
            LOS 4 VECTORES DE LA ARAÑA (EXPLICACIÓN TÉCNICA E INTERACTIVA)
            ========================================================================= */}
        <div style={{ marginBottom: '48px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={20} color="#a78bfa" />
              <span>Los 4 Motores de la Araña Inteligente</span>
            </h2>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Haz clic en cualquier motor para simular su barrido
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
            {SPIDER_ENGINES.map((engine) => {
              const isSelected = activeEngine === engine.tipo;
              const icons = {
                hashtag: <Hash size={20} color="#ec4899" />,
                graph_expansion: <Network size={20} color="#a78bfa" />,
                google_dork: <Search size={20} color="#f59e0b" />,
                location_geotag: <MapPin size={20} color="#10b981" />,
              };

              return (
                <div
                  key={engine.tipo}
                  onClick={() => {
                    setActiveEngine(engine.tipo);
                    handleLaunchSpider(engine.tipo);
                  }}
                  className="glass-card"
                  style={{
                    padding: '20px',
                    cursor: 'pointer',
                    borderColor: isSelected ? '#ec4899' : undefined,
                    background: isSelected ? 'rgba(236,72,153,0.1)' : undefined,
                    boxShadow: isSelected ? '0 0 24px rgba(236,72,153,0.25)' : undefined,
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {icons[engine.tipo]}
                      </div>
                      <span
                        style={{
                          fontSize: '11px',
                          color: '#10b981',
                          background: 'rgba(16,185,129,0.12)',
                          padding: '2px 8px',
                          borderRadius: '10px',
                          fontWeight: 700,
                        }}
                      >
                        {engine.totalDescubiertos} detectados
                      </span>
                    </div>

                    <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '6px' }}>{engine.name}</h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {engine.descripcion}
                    </p>
                  </div>

                  <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11px', color: '#a78bfa', fontWeight: 600 }}>
                      {isSelected && isSpiderRunning ? 'Ejecutando...' : 'Ejecutar este vector →'}
                    </span>
                    <Cpu size={14} color="#a78bfa" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* =========================================================================
            CONSOLA DE LA ARAÑA EN TIEMPO REAL
            ========================================================================= */}
        <div className="glass-card" style={{ padding: '24px', marginBottom: '48px', border: '1px solid rgba(124,58,237,0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: isSpiderRunning ? '#f59e0b' : '#10b981', boxShadow: `0 0 10px ${isSpiderRunning ? '#f59e0b' : '#10b981'}` }} />
              <span style={{ fontWeight: 700, fontSize: '16px' }}>Consola de Rastreo Autónomo (Spider Terminal)</span>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => handleLaunchSpider(activeEngine)}
                disabled={isSpiderRunning}
                className="btn btn-primary btn-sm"
              >
                <RefreshCw size={14} className={isSpiderRunning ? 'animate-spin' : ''} />
                <span>{isSpiderRunning ? 'Rastreando la Red...' : 'Escanear con Araña Completa'}</span>
              </button>
            </div>
          </div>

          {/* Logs terminal box */}
          <div
            style={{
              background: '#07070c',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '10px',
              padding: '16px',
              fontFamily: 'monospace',
              fontSize: '12px',
              color: '#38bdf8',
              minHeight: '120px',
              maxHeight: '220px',
              overflowY: 'auto',
              lineHeight: 1.8,
            }}
          >
            {spiderLogs.length > 0 ? (
              spiderLogs.map((log, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '6px' }}>
                  <span style={{ color: '#ec4899' }}>❯</span>
                  <span style={{ color: log.includes('✅') ? '#4ade80' : log.includes('🚨') ? '#f87171' : '#e2e8f0' }}>
                    {log}
                  </span>
                </div>
              ))
            ) : (
              <div style={{ color: 'var(--text-muted)' }}>
                [Listo] Presiona &quot;Escanear con Araña Completa&quot; o selecciona un vector arriba para ver el rastreo autónomo en acción...
              </div>
            )}
          </div>

          {/* Resumen de Hallazgos de la Araña */}
          {spiderResults && (
            <div
              style={{
                marginTop: '16px',
                padding: '16px',
                borderRadius: '12px',
                background: 'rgba(16,185,129,0.08)',
                border: '1px solid rgba(16,185,129,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: '14px', color: '#6ee7b7', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle2 size={16} />
                  <span>¡Rastreo Exitoso! {spiderResults.eventosAprobados.length} carretes añadidos a la cartelera</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Nuevas cuentas y colectivos descubiertos por la red: <strong>{spiderResults.cuentasDescubiertas.join(', ')}</strong>
                </div>
              </div>

              <Link href="/" className="btn btn-primary btn-sm">
                <span>Ver en la Cartelera</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          )}
        </div>

        {/* =========================================================================
            COMPARATIVA & CUENTAS VIGILADAS + IMPORTADOR DE EMERGENCIA
            ========================================================================= */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '32px' }}>
          {/* Columna Izquierda: Red de Cuentas */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Instagram size={18} color="#ec4899" />
                  <span>Semillas del Grafo (Hubs Clave)</span>
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                  Cuentas nodo desde donde la araña sigue enlaces hacia nuevas tocatas y DJs
                </p>
              </div>
              <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.06)', padding: '3px 8px', borderRadius: '10px', color: 'var(--text-muted)' }}>
                {MONITORED_IG_ACCOUNTS.length} nodos base
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {MONITORED_IG_ACCOUNTS.map((acc) => (
                <div
                  key={acc.handle}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <img
                      src={acc.avatar}
                      alt={acc.nombre}
                      style={{ width: '34px', height: '34px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '13px' }}>{acc.nombre}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{acc.handle} · {acc.ciudad}</div>
                    </div>
                  </div>

                  <a
                    href={`https://instagram.com/${acc.handle.replace('@', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost btn-sm"
                  >
                    <ExternalLink size={13} />
                  </a>
                </div>
              ))}
            </div>
          </div>

          {/* Columna Derecha: Importador Instantáneo con IA */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} color="#f59e0b" />
                <span>Extracción Puntual de Cualquier Flyer</span>
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                ¿Viste un flyer suelto en una historia o post? Pega el texto y la IA estructurará la fecha, lugar y precio.
              </p>
            </div>

            {importSuccess && (
              <div
                style={{
                  padding: '12px',
                  borderRadius: '10px',
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
                <span>¡Carrete procesado y añadido a la cartelera!</span>
              </div>
            )}

            <form onSubmit={handleAnalyzeCaption} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-group">
                  <label className="form-label">Cuenta / DJ</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="@nombre"
                    value={igHandle}
                    onChange={(e) => setIgHandle(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Link de Instagram</label>
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
                <label className="form-label">Texto / Caption del Flyer *</label>
                <textarea
                  className="form-textarea"
                  placeholder="Pega aquí el texto del flyer (ej: ¡ESTE VIERNES 14! Mechoneo en El Huevo, preventa $4.000 con cover, entrada liberada hasta 23:30...)"
                  value={igCaption}
                  onChange={(e) => setIgCaption(e.target.value)}
                  style={{ minHeight: '110px' }}
                  required
                />
              </div>

              <button type="submit" className="btn btn-outline" style={{ justifyContent: 'center' }}>
                <Zap size={15} color="#f59e0b" />
                <span>Analizar y Extraer con IA</span>
              </button>
            </form>

            {preview && (
              <div
                style={{
                  marginTop: '16px',
                  padding: '14px',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(124,58,237,0.3)',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '4px' }}>{preview.nombre}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  {preview.fecha} · {preview.hora} hrs · {preview.lugar} ({preview.ciudad}) · {preview.precio_texto}
                </div>

                <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
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
