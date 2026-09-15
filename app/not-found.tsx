import Link from 'next/link';
export default function NotFound() {
  return (
    <section className="container narrow page-section">
      <p className="eyebrow">ESTE PLAN NO ESTÁ DISPONIBLE</p>
      <h1>
        La noche
        <br />
        <em>sigue por acá.</em>
      </h1>
      <p className="lead">
        El evento pudo haber pasado, estar pendiente de revisión o ya no estar publicado. También
        puede que el enlace sea incorrecto.
      </p>
      <Link href="/explorar" className="button button-primary">
        Ver eventos vigentes ↗
      </Link>
    </section>
  );
}
