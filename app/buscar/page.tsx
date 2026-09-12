'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Search, Filter, MapPin, Calendar, ArrowLeft } from 'lucide-react';
import { Evento, Categoria, CIUDADES, CATEGORIAS } from '../../lib/types';
import { getStoredEvents, filterEvents } from '../../lib/events-store';
import EventCard from '../../components/EventCard';
import SearchBar from '../../components/SearchBar';
import CategoryFilter from '../../components/CategoryFilter';
import DateFilter from '../../components/DateFilter';

function SearchPageContent() {
  const searchParams = useSearchParams();

  const initialCat = (searchParams.get('categoria') as Categoria) || 'todos';
  const initialFecha = (searchParams.get('fecha') as 'todos' | 'hoy' | 'finde' | 'semana') || 'todos';
  const initialQ = searchParams.get('q') || '';
  const initialCity = searchParams.get('ciudad') || 'todos';

  const [events, setEvents] = useState<Evento[]>([]);
  const [searchQuery, setSearchQuery] = useState(initialQ);
  const [selectedCategory, setSelectedCategory] = useState<Categoria | 'todos'>(initialCat);
  const [selectedCity, setSelectedCity] = useState<string | 'todos'>(initialCity);
  const [selectedDate, setSelectedDate] = useState<'todos' | 'hoy' | 'finde' | 'semana'>(initialFecha);
  const [selectedPrice, setSelectedPrice] = useState<'todos' | 'gratis' | 'pago'>('todos');

  const loadEvents = () => {
    setEvents(getStoredEvents());
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const filteredEvents = useMemo(() => {
    return filterEvents(events, {
      busqueda: searchQuery,
      categoria: selectedCategory,
      ciudad: selectedCity,
      fecha: selectedDate,
      precio: selectedPrice,
    });
  }, [events, searchQuery, selectedCategory, selectedCity, selectedDate, selectedPrice]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { todos: events.length };
    events.forEach((e) => {
      counts[e.categoria] = (counts[e.categoria] || 0) + 1;
    });
    return counts;
  }, [events]);

  return (
    <div style={{ padding: '32px 0 80px' }}>
      <div className="container">
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              color: 'var(--text-secondary)',
              marginBottom: '16px',
            }}
          >
            <ArrowLeft size={16} />
            <span>Volver al inicio</span>
          </Link>

          <h1 style={{ fontSize: 'clamp(24px, 4vw, 36px)', marginBottom: '8px' }}>
            Explorador de <span className="text-gradient">Carretes V Región</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Filtra por comuna, fecha, tipo de música o busca directamente por local.
          </p>
        </div>

        {/* Search Bar */}
        <div style={{ marginBottom: '24px' }}>
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
        </div>

        {/* Panel de Filtros */}
        <div className="glass-card" style={{ padding: '20px', marginBottom: '32px' }}>
          {/* Fila 1: Fechas y Comunas */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '16px' }}>
            <DateFilter selected={selectedDate} onSelect={setSelectedDate} />

            {/* Selector de Comuna */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Comuna:</span>
              <button
                onClick={() => setSelectedCity('todos')}
                style={{
                  fontSize: '12px',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-full)',
                  background: selectedCity === 'todos' ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.04)',
                  border: selectedCity === 'todos' ? '1px solid #a78bfa' : '1px solid var(--color-border)',
                  color: selectedCity === 'todos' ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                Todas
              </button>
              {CIUDADES.map((c) => (
                <button
                  key={c}
                  onClick={() => setSelectedCity(c)}
                  style={{
                    fontSize: '12px',
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-full)',
                    background: selectedCity === c ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.04)',
                    border: selectedCity === c ? '1px solid #a78bfa' : '1px solid var(--color-border)',
                    color: selectedCity === c ? '#fff' : 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Fila 2: Categorías */}
          <CategoryFilter selected={selectedCategory} onSelect={setSelectedCategory} counts={categoryCounts} />

          {/* Fila 3: Precio & Reset */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--color-border)', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Precio:</span>
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
              Solo Gratis
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
              Con Entrada
            </button>

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
              Limpiar filtros
            </button>
          </div>
        </div>

        {/* Resultados */}
        <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
            Mostrando <strong>{filteredEvents.length}</strong> {filteredEvents.length === 1 ? 'carrete' : 'carretes'}
          </span>
        </div>

        {filteredEvents.length > 0 ? (
          <div className="event-grid stagger">
            {filteredEvents.map((evt) => (
              <EventCard key={evt.id} evento={evt} onRsvpChange={loadEvents} />
            ))}
          </div>
        ) : (
          <div className="empty-state glass-card">
            <div className="empty-state-icon">🔍</div>
            <h3>Sin resultados</h3>
            <p>Prueba combinando otros filtros o busca algo más general.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="container" style={{ padding: '60px 0', textAlign: 'center' }}>Cargando explorador...</div>}>
      <SearchPageContent />
    </Suspense>
  );
}
