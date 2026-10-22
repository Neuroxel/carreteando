import Link from 'next/link';
import { Suspense } from 'react';
import NavDestinos from './NavDestinos';
import BrandLink from './BrandLink';
import { Logo } from './Logo';
export default function Navbar() {
  return (
    <header className="site-header">
      <div className="container nav-inner">
        <BrandLink className="brand">
          <Logo className="brand-logo" title="Dónde Salgo?" />
        </BrandLink>
        <nav aria-label="Navegación principal">
          <Suspense
            fallback={
              <Link prefetch={false} href="/publicar" className="nav-publish">
                Aportar <span aria-hidden="true">↗</span>
              </Link>
            }
          >
            <NavDestinos />
          </Suspense>
        </nav>
      </div>
    </header>
  );
}
