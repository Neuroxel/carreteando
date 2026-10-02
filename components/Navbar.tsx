import Link from 'next/link';
export default function Navbar() {
  return (
    <header className="site-header">
      <div className="container nav-inner">
        <Link prefetch={false} className="brand" href="/" aria-label="Carreteando, inicio">
          CARRETEANDO<span className="brand-dot">✳</span>
        </Link>
        <nav aria-label="Navegación principal">
          <Link prefetch={false} href="/explorar">Explorar</Link>
          <Link prefetch={false} href="/explorar?vista=mapa">Mapa</Link>
          <Link prefetch={false} href="/publicar" className="nav-publish">
            Aportar <span aria-hidden="true">↗</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
