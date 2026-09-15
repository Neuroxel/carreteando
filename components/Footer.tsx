import Link from 'next/link';
export default function Footer() {
  return (
    <footer className="site-footer container">
      <div>
        <Link href="/" className="brand">
          CARRETEANDO<span className="brand-dot">✳</span>
        </Link>
        <p>
          La noche es local.
          <br />
          Valpo, Viña y los circuitos de la costa.
        </p>
      </div>
      <nav aria-label="Información">
        <Link href="/como-funciona">Cómo funciona</Link>
        <Link href="/confianza">Fuentes y confianza</Link>
        <Link href="/zonas">Explorar por zona</Link>
        <Link href="/explorar?ver=lugares">Lugares para salir</Link>
        <Link href="/publicar">Proponer un evento</Link>
      </nav>
      <p className="footer-note">
        Consulta la fuente antes de salir.
        <br />
        Horarios, precios y condiciones pueden cambiar.
      </p>
    </footer>
  );
}
