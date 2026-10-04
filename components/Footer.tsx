import Link from 'next/link';
export default function Footer() {
  return (
    <footer className="site-footer container">
      <div>
        <Link prefetch={false} href="/" className="brand">
          DÓNDE SALGO<span className="brand-q">?</span>
        </Link>
        <p>
          Eventos y lugares para salir.
          <br />
          Valpo, Viña y alrededores.
        </p>
      </div>
      <nav aria-label="Información">
        <Link prefetch={false} href="/como-funciona">Cómo funciona</Link>
        <Link prefetch={false} href="/confianza">Fuentes y confianza</Link>
        <Link prefetch={false} href="/zonas">Explorar por zona</Link>
        <Link prefetch={false} href="/explorar?ver=lugares">Lugares para salir</Link>
        <Link prefetch={false} href="/publicar">Proponer un evento</Link>
      </nav>
      <p className="footer-note">
        Consulta la fuente antes de salir.
        <br />
        Horarios, precios y condiciones pueden cambiar.
      </p>
    </footer>
  );
}
