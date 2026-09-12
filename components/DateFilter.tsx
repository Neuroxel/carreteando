'use client';

import React from 'react';
import { Calendar, Flame, Zap, Sparkles } from 'lucide-react';

interface DateFilterProps {
  selected: 'todos' | 'hoy' | 'finde' | 'semana';
  onSelect: (dateFilter: 'todos' | 'hoy' | 'finde' | 'semana') => void;
}

export default function DateFilter({ selected, onSelect }: DateFilterProps) {
  const options: { id: 'todos' | 'hoy' | 'finde' | 'semana'; label: string; icon: React.ReactNode }[] = [
    { id: 'todos', label: 'Cualquier Fecha', icon: <Sparkles size={14} /> },
    { id: 'hoy', label: 'Esta Noche (Hoy)', icon: <Flame size={14} color="#f97316" /> },
    { id: 'finde', label: 'Este Finde (Vie-Dom)', icon: <Zap size={14} color="#a855f7" /> },
    { id: 'semana', label: 'Próximos 7 Días', icon: <Calendar size={14} color="#3b82f6" /> },
  ];

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        background: 'rgba(255,255,255,0.03)',
        padding: '4px',
        borderRadius: 'var(--radius-full)',
        border: '1px solid var(--color-border)',
      }}
    >
      {options.map((opt) => {
        const isSelected = selected === opt.id;
        return (
          <button
            key={opt.id}
            onClick={() => onSelect(opt.id)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: 'var(--radius-full)',
              fontSize: '12px',
              fontWeight: isSelected ? 600 : 500,
              color: isSelected ? '#f8fafc' : 'var(--text-secondary)',
              background: isSelected ? 'var(--gradient-brand)' : 'transparent',
              boxShadow: isSelected ? '0 2px 10px rgba(124,58,237,0.3)' : 'none',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap',
            }}
          >
            {opt.icon}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
