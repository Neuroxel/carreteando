import Link from 'next/link';
import { Compass, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="container" style={{ padding: '100px 0', textAlign: 'center' }}>
      <div
        style={{
          width: '72px',
          height: '72px',
          borderRadius: '50%',
          background: 'rgba(236,72,153,0.15)',
          border: '1px solid rgba(236,72,153,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
          color: '#ec4899',
        }}
      >
        <Compass size={36} />
      </div>
      <h1 style={{ fontSize: '32px', marginBottom: '12px' }}>Página no encontrada</h1>
      <p style={{ color: 'var(--text-secondary)', maxWidth: '440px', margin: '0 auto 24px' }}>
        Parece que este carrete ya terminó o la dirección no existe. Vuelve a la cartelera para ver qué hay hoy en Valparaíso y Viña.
      </p>
      <Link href="/" className="btn btn-primary">
        <ArrowLeft size={16} />
        <span>Volver a la Portada</span>
      </Link>
    </div>
  );
}
