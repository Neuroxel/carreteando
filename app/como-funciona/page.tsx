import Link from 'next/link';
export const metadata = { title: 'Cómo funciona', alternates: { canonical: '/como-funciona' } };
export default function How() {
  return (
    <article className="container narrow page-section prose">
      <p className="eyebrow">MENOS VUELTAS. MÁS NOCHE.</p>
      <h1>
        Del dato
        <br />
        <em>al encuentro.</em>
      </h1>
      <p className="lead">
        Carreteando reúne vida nocturna de Valparaíso, Viña del Mar, Reñaca, Quilpué, Villa Alemana
        y Concón.
      </p>
      <h2>01 / Encuentra tu noche</h2>
      <p>
        Parte por hoy o este finde. Filtra por zona, estilo y entrada gratis. Las fechas se calculan
        en hora de Chile; no mostramos eventos vencidos como próximos planes.
      </p>
      <h2>02 / Revisa lo importante</h2>
      <p>
        Entra al evento para ver fecha, lugar, precio y su publicación original. Lo que no conocemos
        aparece por confirmar. Carreteando no vende entradas ni garantiza acceso.
      </p>
      <h2>03 / Junta al grupo</h2>
      <p>
        Comparte el enlace desde tu teléfono o cópialo para WhatsApp. Cada evento tiene una
        dirección propia que se puede abrir sin cuenta.
      </p>
      <h2>04 / Haz circular un dato útil</h2>
      <p>
        Si falta un evento, envíalo con su fuente. Si un dato cambió, repórtalo desde la página del
        evento. Ambos pasan por revisión.
      </p>
      <div className="actions">
        <Link href="/explorar" className="button button-primary">
          Explorar ↗
        </Link>
        <Link href="/confianza" className="button button-outline">
          Fuentes y confianza
        </Link>
      </div>
    </article>
  );
}
