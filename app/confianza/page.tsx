import Link from 'next/link';
export const metadata = { title: 'Fuentes y confianza', alternates: { canonical: '/confianza' } };
export default function Trust() {
  return (
    <article className="container narrow page-section prose">
      <p className="eyebrow">EL DATO TIENE QUE SERVIR</p>
      <h1>
        Una fuente.
        <br />
        <em>No una promesa.</em>
      </h1>
      <p className="lead">
        Una publicación no siempre es un evento. Contrastamos las propuestas antes de sumarlas a la
        cartelera y dejamos visible de dónde viene cada dato.
      </p>
      <h2>Qué significa cada etiqueta</h2>
      <dl>
        <dt>Detectado · fuente revisada</dt>
        <dd>
          Encontramos el evento en una cuenta pública y revisamos su información. No significa que
          el organizador lo haya confirmado directamente con Carreteando.
        </dd>
        <dt>Curaduría · fuente revisada</dt>
        <dd>
          Revisamos una ficha pública del recinto o de venta de entradas. La fecha, el lugar y el
          precio conocido quedan enlazados a esa fuente; no implica una confirmación directa del
          organizador.
        </dd>
        <dt>Comunidad · revisado</dt>
        <dd>Alguien envió el dato y pasó por revisión antes de publicarse.</dd>
        <dt>Organizador verificado</dt>
        <dd>
          Se reserva para una confirmación directa y documentada de quien organiza. No se asigna
          automáticamente por tener una cuenta de Instagram.
        </dd>
      </dl>
      <h2>Lo que revisamos</h2>
      <p>
        Que sea un evento de vida nocturna de la región, que la fecha corresponda al evento y siga
        vigente, que haya una fuente identificable y que no sea otra promoción de un plan ya
        publicado. Una fecha ambigua queda pendiente.
      </p>
      <p>
        “Precio por confirmar” no significa gratis. Una revisión tampoco garantiza que el evento
        siga sin cambios: comprueba siempre la publicación original, la dirección y las condiciones
        de entrada antes de salir.
      </p>
      <h2>Si algo cambió</h2>
      <p>
        Cada página de evento tiene un formulario para reportar fecha, lugar, precio, duplicados o
        cancelaciones. Los reportes llegan a una bandeja privada de revisión. La corrección no es
        automática y no garantizamos atención en tiempo real.
      </p>
      <h2>Privacidad y aportes</h2>
      <p>
        No rastreamos asistentes, no publicamos listas de personas y no usamos analítica de
        comportamiento ni publicidad personalizada. Guardamos el contenido que envías para
        revisarlo. No incluyas información personal ni ubicaciones privadas.
      </p>
      <p>
        Para limitar el spam usamos un identificador derivado de la IP con una clave secreta y
        rotación diaria, sin guardar la IP en la bandeja. La infraestructura de alojamiento puede
        conservar registros técnicos. Los enlaces e imágenes de terceros se rigen por sus propias
        políticas.
      </p>
      <p>
        La revisión se gestiona desde una bandeja interna. Proponer un evento no garantiza su
        aceptación. Si organizas y quieres corregir la atribución, usa el reporte del evento y
        enlaza evidencia pública.
      </p>
      <Link href="/publicar" className="button button-primary">
        Proponer un evento ↗
      </Link>
    </article>
  );
}
