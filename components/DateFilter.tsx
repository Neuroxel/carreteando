'use client';

import React from 'react';
import { Calendar, Flame, Zap, Sparkles } from 'lucide-react';

interface DateFilterProps {
  selected: 'todos' | 'hoy' | 'finde' | 'futuro' | 'semana';
  onSelect: (dateFilter: 'todos' | 'hoy' | 'finde' | 'futuro' | 'semana') => void;
  todayCount?: number;
  futureCount?: number;
}

export default function DateFilter({ selected, onSelect, todayCount, futureCount }: DateFilterProps) {
  const options: {
    id: 'hoy' | 'futuro' | 'finde' | 'todos';
    label: string;
    count?: number;
    icon: React.ReactNode;
    highlight?: string;
  }[] = [
    {
      id: 'hoy',
      label: '🔥 ESTA NOCHE (HOY)',
      count: todayCount,
      icon: <Flame size={14} color="#f97316" />,
      highlight: 'linear-gradient(135deg, #f97316 0%, #ec4899 100%)',
    },
    {
      id: 'futuro',
      label: '🚀 PRÓXIMOS & FUTURO',
      count: futureCount,
      icon: <Sparkles size={14} color="#ec4899" />,
      highlight: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
    },
    {
      id: 'finde',
      label: '⚡ ESTE FINDE',
      icon: <Zap size={14} color="#a855f7" />,
      highlight: 'var(--gradient-brand)',
    },
    {
      id: 'todos',
      label: '📅 Todos',
      icon: <Calendar size={14} color="#94a3b8" />,
      highlight: 'rgba(255,255,255,0.15)',
    },
  ];

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(10px)',
        padding: '4px',
        borderRadius: 'var(--radius-full)',
        border: '1px solid rgba(255,255,255,0.12)',
        flexWrap: 'wrap',
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
              fontWeight: isSelected ? 700 : 500,
              color: isSelected ? '#ffffff' : 'var(--text-secondary)',
              background: isSelected ? opt.highlight || 'var(--gradient-brand)' : 'transparent',
              boxShadow: isSelected ? '0 2px 14px rgba(236,72,153,0.4)' : 'none',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap',
              border: isSelected ? '1px solid rgba(255,255,255,0.3)' : '1px solid transparent',
              cursor: 'pointer',
            }}
          >
            {opt.icon}
            <span>{opt.label}</span>
            {opt.count !== undefined && opt.count > 0 && (
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  background: isSelected ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.1)',
                  color: isSelected ? '#fff' : '#cbd5e1',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  marginLeft: '2px',
                }}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
