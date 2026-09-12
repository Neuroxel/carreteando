'use client';

import React from 'react';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  onQuickSelect?: (val: string) => void;
}

const QUICK_TAGS = [
  '🔥 Mechoneo',
  '🍻 Gratis',
  '🎧 Techno',
  '⚡ Subida Ecuador',
  '🌊 Reñaca',
  '🪗 Cumbia',
  '🌙 Under',
  '🎸 Post-Punk',
];

export default function SearchBar({
  value,
  onChange,
  placeholder = 'Buscar por local, DJ, U, o sector (ej: El Huevo, Techno, Subida Ecuador)...',
  onQuickSelect,
}: SearchBarProps) {
  return (
    <div style={{ width: '100%', maxWidth: '780px', margin: '0 auto' }}>
      {/* Search Input Container */}
      <div className="search-bar">
        <Search size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label="Buscar carretes"
        />
        {value && (
          <button
            onClick={() => onChange('')}
            style={{
              color: 'var(--text-muted)',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
            }}
            title="Limpiar búsqueda"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Quick suggestions pills */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          overflowX: 'auto',
          padding: '12px 4px 4px',
          justifyContent: 'center',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, marginRight: '4px' }}>
          Tendencias:
        </span>
        {QUICK_TAGS.map((tag) => {
          const cleanTag = tag.replace(/^[^\w\s]+/, '').trim();
          const isSelected = value.toLowerCase().includes(cleanTag.toLowerCase());
          return (
            <button
              key={tag}
              onClick={() => {
                const nextVal = isSelected ? '' : cleanTag;
                onChange(nextVal);
                if (onQuickSelect) onQuickSelect(nextVal);
              }}
              style={{
                fontSize: '11px',
                padding: '4px 10px',
                borderRadius: 'var(--radius-full)',
                background: isSelected ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.04)',
                border: isSelected ? '1px solid #a78bfa' : '1px solid var(--color-border)',
                color: isSelected ? '#a78bfa' : 'var(--text-secondary)',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {tag}
            </button>
          );
        })}
      </div>
    </div>
  );
}
