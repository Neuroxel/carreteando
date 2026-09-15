import Link from 'next/link';
export default function Navbar() {
  return (
    <header className="site-header">
      <div className="container nav-inner">
        <Link className="brand" href="/" aria-label="Carreteando, inicio">
          CARRETEANDO<span className="brand-dot">✳</span>
        </Link>
        <nav aria-label="Navegación principal">
          <Link href="/buscar">Explorar</Link>
          <Link href="/buscar?fecha=finde">Este finde</Link>
          <Link href="/lugares">Lugares</Link>
          <Link href="/lugares?vista=mapa">Mapa</Link>
          <Link href="/publicar" className="nav-publish">
            Publicar <span aria-hidden="true">↗</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
