import Link from 'next/link';
import { Logo } from './Logo';
import MovimientoOptIn from './MovimientoOptIn';

export const INSTAGRAM_OFICIAL = 'https://www.instagram.com/dondesalgo.cl/';
export const CORREO_CONTACTO = 'dondesalgo.cl@gmail.com';
export default function Footer() {
  return (
    <footer className="site-footer container">
      <div>
        <Link prefetch={false} href="/" className="brand">
          <Logo className="brand-logo" title="Dónde Salgo?" />
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
      <nav aria-label="Contacto y redes" className="footer-contacto">
        <a href={INSTAGRAM_OFICIAL} target="_blank" rel="noopener noreferrer">
          Instagram @dondesalgo.cl<span className="sr-only"> (abre en otra pestaña)</span>
        </a>
        <a href={`mailto:${CORREO_CONTACTO}`}>{CORREO_CONTACTO}</a>
        <MovimientoOptIn />
      </nav>
      <p className="footer-note">
        Consulta la fuente antes de salir.
        <br />
        Horarios, precios y condiciones pueden cambiar.
      </p>
    </footer>
  );
}
