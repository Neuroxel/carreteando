'use client';

import React from 'react';
import { CATEGORIAS, Categoria } from '../lib/types';

interface CategoryFilterProps {
  selected: Categoria | 'todos';
  onSelect: (cat: Categoria | 'todos') => void;
  counts?: Record<string, number>;
}

export default function CategoryFilter({
  selected,
  onSelect,
  counts = {},
}: CategoryFilterProps) {
  return (
    <div className="filters-bar" style={{ padding: '4px 0 8px', display: 'flex', gap: '8px' }}>
      {/* Botón Todos */}
      <button
        onClick={() => onSelect('todos')}
        className={`filter-chip ${selected === 'todos' ? 'active' : ''}`}
      >
        <span>⚡</span>
        <span>Todos</span>
        {counts['todos'] !== undefined && (
          <span style={{ fontSize: '11px', opacity: 0.7 }}>({counts['todos']})</span>
        )}
      </button>

      {/* Categorías específicas */}
      {CATEGORIAS.map((cat) => {
        const isSelected = selected === cat.value;
        const count = counts[cat.value];
        return (
          <button
            key={cat.value}
            onClick={() => onSelect(cat.value)}
            className={`filter-chip ${isSelected ? 'active' : ''}`}
            title={cat.desc}
          >
            <span>{cat.emoji}</span>
            <span>{cat.label}</span>
            {count !== undefined && count > 0 && (
              <span
                style={{
                  fontSize: '10px',
                  background: isSelected ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  marginLeft: '2px',
                }}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
