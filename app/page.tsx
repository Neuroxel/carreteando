'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Flame,
  Sparkles,
  Calendar,
  Radio,
  MapPin,
  PlusCircle,
  TrendingUp,
  Filter,
  CheckCircle2,
  Compass,
  ArrowRight,
} from 'lucide-react';
import { Evento, Categoria, CIUDADES, CATEGORIAS } from '../lib/types';
import { getStoredEvents, filterEvents } from '../lib/events-store';
import EventCard from '../components/EventCard';
import SearchBar from '../components/SearchBar';
import CategoryFilter from '../components/CategoryFilter';
import DateFilter from '../components/DateFilter';

export default function HomePage() {
  const [events, setEvents] = useState<Evento[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Categoria | 'todos'>('todos');
  const [selectedCity, setSelectedCity] = useState<string | 'todos'>('todos');
  const [selectedDate, setSelectedDate] = useState<'todos' | 'hoy' | 'finde' | 'semana'>('todos');
  const [selectedPrice, setSelectedPrice] = useState<'todos' | 'gratis' | 'pago'>('todos');
  const [mounted, setMounted] = useState(false);

  // Cargar eventos del store
  const loadEvents = () => {
    setEvents(getStoredEvents());
  };

  useEffect(() => {
    setMounted(true);
    loadEvents();

    const handleStorageUpdate = () => {
      loadEvents();
    };

    window.addEventListener('carretes_storage_updated', handleStorageUpdate);
    return () => {
      window.removeEventListener('carretes_storage_updated', handleStorageUpdate);
    };
  }, []);

  // Filtrado reactivo en tiempo real
  const filteredEvents = useMemo(() => {
    return filterEvents(events, {
      busqueda: searchQuery,
      categoria: selectedCategory,
      ciudad: selectedCity,
      fecha: selectedDate,
      precio: selectedPrice,
    });
  }, [events, searchQuery, selectedCategory, selectedCity, selectedDate, selectedPrice]);

  // Contadores por categoría para los pills
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { todos: events.length };
    events.forEach((e) => {
      counts[e.categoria] = (counts[e.categoria] || 0) + 1;
    });
    return counts;
  }, [events]);

  // Eventos destacados para el carousel o sección HOT
  const hotEvents = useMemo(() => {
    return events.filter((e) => e.destacado).slice(0, 3);
  }, [events]);

  return (
    <div>
      {/* ============================================
          HERO SECTION
          ============================================ */}
      <section className="hero">
        <div className="container">
          {/* Eyebrow badge */}
          <div className="hero-eyebrow animate-fade-in">
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#ec4899', boxShadow: '0 0 10px #ec4899' }} />
            <span>Centralizador de Fiestas & Carretes · V Región de Chile</span>
          </div>

          {/* Main Title */}
          <h1 className="animate-fade-in-up" style={{ lineHeight: 1.08 }}>
            ¿DÓNDE SE <span className="text-gradient">CARRETEA HOY</span> EN VALPO & VIÑA?
          </h1>

          {/* Subtitle */}
          <p className="hero-description animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            Como el viejo Facebook Events, pero alimentado por la <strong>Instagram-osfera</strong>. Mechoneos universitarios, tocatas, raves under y previas de la costa centralizadas en un solo lugar.
          </p>

          {/* Search Bar */}
          <div className="animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Buscar carrete por local, DJ, U o sector (ej: El Huevo, Techno, Subida Ecuador)..."
            />
          </div>

          {/* Quick City Switcher */}
          <div
            className="animate-fade-in-up"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              marginTop: '18px',
              flexWrap: 'wrap',
              animationDelay: '0.2s',
            }}
          >
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <MapPin size={13} color="#ec4899" /> Comuna:
            </span>
            <button
              onClick={() => setSelectedCity('todos')}
              style={{
                fontSize: '12px',
                padding: '4px 12px',
                borderRadius: 'var(--radius-full)',
                background: selectedCity === 'todos' ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.04)',
                border: selectedCity === 'todos' ? '1px solid #a78bfa' : '1px solid var(--color-border)',
                color: selectedCity === 'todos' ? '#f8fafc' : 'var(--text-secondary)',
                fontWeight: selectedCity === 'todos' ? 600 : 500,
                cursor: 'pointer',
              }}
            >
              Toda la V Región
            </button>
            {CIUDADES.map((c) => (
              <button
                key={c}
                onClick={() => setSelectedCity(c)}
                style={{
                  fontSize: '12px',
                  padding: '4px 12px',
                  borderRadius: 'var(--radius-full)',
                  background: selectedCity === c ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.04)',
                  border: selectedCity === c ? '1px solid #a78bfa' : '1px solid var(--color-border)',
                  color: selectedCity === c ? '#f8fafc' : 'var(--text-secondary)',
                  fontWeight: selectedCity === c ? 600 : 500,
                  cursor: 'pointer',
                }}
              >
                {c}
              </button>
            ))}
          </div>

          {/* Stats Bar */}
          <div className="hero-stats">
            <div>
              <div className="hero-stat-value">{events.length}</div>
              <div className="hero-stat-label">Carretes Activos</div>
            </div>
            <div>
              <div className="hero-stat-value">8+</div>
              <div className="hero-stat-label">Cuentas IG Monitoreadas</div>
            </div>
            <div>
              <div className="hero-stat-value">100%</div>
              <div className="hero-stat-label">Libre y Gratuito</div>
            </div>
            <div>
              <div className="hero-stat-value">V Región</div>
              <div className="hero-stat-label">Valpo · Viña · Quilpué</div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================
          LIVE INSTAGRAM RADAR BANNER
          ============================================ */}
      <section style={{ padding: '0 0 32px' }}>
        <div className="container">
          <div
            className="glass-card"
            style={{
              padding: '16px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              flexWrap: 'wrap',
              background: 'linear-gradient(90deg, rgba(124,58,237,0.15) 0%, rgba(236,72,153,0.12) 100%)',
              borderColor: 'rgba(124,58,237,0.3)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: 'rgba(236,72,153,0.2)',
                  border: '1px solid rgba(236,72,153,0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ec4899',
                  flexShrink: 0,
                }}
              >
                <Radio size={20} className="animate-pulse" />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 700, fontSize: '15px' }}>Radar Instagram en Tiempo Real</span>
                  <span
                    style={{
                      fontSize: '10px',
                      background: '#10b981',
                      color: '#000',
                      fontWeight: 800,
                      padding: '2px 6px',
                      borderRadius: '8px',
                      letterSpacing: '0.04em',
                    }}
                  >
                    ACTIVO
                  </span>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                  Escaneando flyers y stories de @elhuevovalpo, @terrazabellavista_valpo, @mascaraclub_oficial, centros de alumnos y más.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Link href="/radar" className="btn btn-outline btn-sm">
                <span>Ver Radar & Cuentas</span>
                <ArrowRight size={13} />
              </Link>
              <Link href="/publicar" className="btn btn-primary btn-sm">
                <PlusCircle size={14} />
                <span>Subir Mi Flyer</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================
          MAIN FEED & FILTERS
          ============================================ */}
      <section style={{ padding: '16px 0 60px' }}>
        <div className="container">
          {/* Header de sección con filtros de fecha y precio */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div>
              <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>Cartelera de Carretes</span>
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#a78bfa',
                    background: 'rgba(124,58,237,0.15)',
                    padding: '2px 10px',
                    borderRadius: '12px',
                  }}
                >
                  {filteredEvents.length} {filteredEvents.length === 1 ? 'evento' : 'eventos'}
                </span>
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                {selectedCity === 'todos' ? 'En toda la V Región' : `En ${selectedCity}`} · Actualizado constantemente
              </p>
            </div>

            {/* Selector de Fechas */}
            <DateFilter selected={selectedDate} onSelect={setSelectedDate} />
          </div>

          {/* Filtros de Categoría */}
          <div style={{ marginBottom: '16px' }}>
            <CategoryFilter
              selected={selectedCategory}
              onSelect={setSelectedCategory}
              counts={categoryCounts}
            />
          </div>

          {/* Filtro secundario: Precio (Todos, Gratis, Con Entrada) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Entrada:</span>
            <button
              onClick={() => setSelectedPrice('todos')}
              style={{
                fontSize: '11px',
                padding: '3px 10px',
                borderRadius: 'var(--radius-full)',
                background: selectedPrice === 'todos' ? 'rgba(255,255,255,0.1)' : 'transparent',
                border: '1px solid var(--color-border)',
                color: selectedPrice === 'todos' ? '#fff' : 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              Cualquiera
            </button>
            <button
              onClick={() => setSelectedPrice('gratis')}
              style={{
                fontSize: '11px',
                padding: '3px 10px',
                borderRadius: 'var(--radius-full)',
                background: selectedPrice === 'gratis' ? 'rgba(16,185,129,0.2)' : 'transparent',
                border: selectedPrice === 'gratis' ? '1px solid #10b981' : '1px solid var(--color-border)',
                color: selectedPrice === 'gratis' ? '#6ee7b7' : 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              🎉 Solo Gratis / Con Lista
            </button>
            <button
              onClick={() => setSelectedPrice('pago')}
              style={{
                fontSize: '11px',
                padding: '3px 10px',
                borderRadius: 'var(--radius-full)',
                background: selectedPrice === 'pago' ? 'rgba(245,158,11,0.2)' : 'transparent',
                border: selectedPrice === 'pago' ? '1px solid #f59e0b' : '1px solid var(--color-border)',
                color: selectedPrice === 'pago' ? '#fcd34d' : 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              🎫 Con Entrada / Preventa
            </button>

            {/* Reset Filters button if any active */}
            {(searchQuery || selectedCategory !== 'todos' || selectedCity !== 'todos' || selectedDate !== 'todos' || selectedPrice !== 'todos') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('todos');
                  setSelectedCity('todos');
                  setSelectedDate('todos');
                  setSelectedPrice('todos');
                }}
                style={{
                  fontSize: '11px',
                  color: '#ec4899',
                  background: 'transparent',
                  marginLeft: 'auto',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                }}
              >
                Limpiar todos los filtros
              </button>
            )}
          </div>

          {/* Grid de Eventos */}
          {filteredEvents.length > 0 ? (
            <div className="event-grid stagger">
              {filteredEvents.map((evt) => (
                <EventCard key={evt.id} evento={evt} onRsvpChange={loadEvents} />
              ))}
            </div>
          ) : (
            <div className="empty-state glass-card">
              <div className="empty-state-icon">🔍</div>
              <h3>No encontramos carretes con estos filtros</h3>
              <p style={{ maxWidth: '400px', margin: '0 auto 16px' }}>
                Prueba buscando con otros términos o cambia la comuna y fecha para ver qué más hay en la zona.
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('todos');
                  setSelectedCity('todos');
                  setSelectedDate('todos');
                  setSelectedPrice('todos');
                }}
                className="btn btn-outline"
              >
                Restablecer Filtros
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ============================================
          COMMUNITY PROMOTER CTA BANNER
          ============================================ */}
      <section style={{ padding: '0 0 60px' }}>
        <div className="container">
          <div
            className="glass-card"
            style={{
              padding: '48px 32px',
              textAlign: 'center',
              position: 'relative',
              overflow: 'hidden',
              background: 'radial-gradient(ellipse at center, rgba(124,58,237,0.2) 0%, rgba(10,10,15,0.8) 100%)',
              borderColor: 'rgba(124,58,237,0.3)',
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: 700,
                color: '#a78bfa',
                background: 'rgba(124,58,237,0.2)',
                padding: '4px 12px',
                borderRadius: 'var(--radius-full)',
                marginBottom: '16px',
              }}
            >
              <Sparkles size={13} />
              <span>Para Centros de Alumnos, Productores & DJs</span>
            </div>

            <h2 style={{ fontSize: 'clamp(24px, 4vw, 36px)', marginBottom: '12px', maxWidth: '640px', margin: '0 auto 12px' }}>
              ¿Organizas un carrete, tocata o fiesta en la V Región?
            </h2>

            <p style={{ color: 'var(--text-secondary)', maxWidth: '520px', margin: '0 auto 24px', fontSize: '15px' }}>
              Publica tu flyer gratis en 30 segundos. Llega directamente a miles de jóvenes universitarios y bohemios de Valparaíso, Viña, Reñaca y Quilpué.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <Link href="/publicar" className="btn btn-primary btn-lg">
                <PlusCircle size={18} />
                <span>Publicar Evento Gratis</span>
              </Link>
              <Link href="/radar" className="btn btn-outline btn-lg">
                <Radio size={18} color="#ec4899" />
                <span>Añadir mi cuenta de Instagram al Radar</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
