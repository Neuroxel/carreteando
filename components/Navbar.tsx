'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sparkles,
  Calendar,
  Radio,
  MapPin,
  PlusCircle,
  Menu,
  X,
  Compass,
  Instagram,
} from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: '/', label: 'Explorar', icon: Compass },
    { href: '/buscar?fecha=finde', label: 'Este Finde', icon: Calendar },
    { href: '/radar', label: 'Radar Instagram', icon: Radio, highlight: true },
    { href: '/mapa', label: 'Mapa Bohemio', icon: MapPin },
  ];

  return (
    <header className="header">
      <div className="container">
        <div className="header-inner">
          {/* Logo */}
          <Link href="/" className="header-logo" onClick={() => setMobileMenuOpen(false)}>
            <div className="header-logo-icon">
              <Sparkles size={20} className="text-white" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="text-gradient" style={{ fontWeight: 800, letterSpacing: '-0.03em' }}>
                  CARRETES
                </span>
                <span style={{ fontSize: '12px', background: 'rgba(236,72,153,0.2)', color: '#f472b6', padding: '2px 8px', borderRadius: '12px', border: '1px solid rgba(236,72,153,0.4)', fontWeight: 600 }}>
                  V REGIÓN
                </span>
              </span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                Valpo · Viña · Reñaca · Quilpué
              </span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="header-nav" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.03)', padding: '4px 6px', borderRadius: 'var(--radius-full)', border: '1px solid var(--color-border)' }}>
              {navLinks.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`btn btn-ghost btn-sm ${isActive ? 'active' : ''}`}
                    style={{
                      borderRadius: 'var(--radius-full)',
                      color: isActive ? '#f8fafc' : 'var(--text-secondary)',
                      background: isActive ? 'rgba(124,58,237,0.25)' : 'transparent',
                      fontWeight: isActive ? 600 : 500,
                      position: 'relative',
                    }}
                  >
                    <Icon size={14} style={{ color: item.highlight ? '#ec4899' : undefined }} />
                    <span>{item.label}</span>
                    {item.highlight && (
                      <span
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: '#ec4899',
                          boxShadow: '0 0 8px #ec4899',
                        }}
                      />
                    )}
                  </Link>
                );
              })}
            </div>

            {/* Action CTA */}
            <Link href="/publicar" className="btn btn-primary btn-sm" style={{ marginLeft: '6px' }}>
              <PlusCircle size={15} />
              <span>Publicar Carrete</span>
            </Link>
          </nav>

          {/* Mobile hamburger button */}
          <div style={{ display: 'none' }} className="mobile-toggle-btn">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{
                color: 'var(--text-primary)',
                padding: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(255,255,255,0.06)',
                borderRadius: '8px',
              }}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div
          style={{
            background: '#0d0d17',
            borderBottom: '1px solid var(--color-border)',
            padding: '16px 20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {navLinks.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  background: isActive ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.03)',
                  color: isActive ? '#a78bfa' : 'var(--text-primary)',
                  fontWeight: 600,
                  fontSize: '15px',
                }}
              >
                <Icon size={18} />
                <span>{item.label}</span>
                {item.highlight && (
                  <span style={{ marginLeft: 'auto', fontSize: '11px', background: 'rgba(236,72,153,0.2)', color: '#f472b6', padding: '2px 8px', borderRadius: '10px' }}>
                    EN VIVO
                  </span>
                )}
              </Link>
            );
          })}
          <Link
            href="/publicar"
            onClick={() => setMobileMenuOpen(false)}
            className="btn btn-primary"
            style={{ justifyContent: 'center', marginTop: '8px' }}
          >
            <PlusCircle size={16} />
            <span>Publicar Mi Carrete / Flyer</span>
          </Link>
        </div>
      )}

      <style jsx>{`
        @media (max-width: 820px) {
          .header-nav {
            display: none !important;
          }
          .mobile-toggle-btn {
            display: block !important;
          }
        }
      `}</style>
    </header>
  );
}
