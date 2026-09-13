'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="container narrow page-section" role="alert">
      <p className="eyebrow">CONEXIÓN INTERRUMPIDA</p>
      <h1>
        No pudimos
        <br />
        <em>cargar el plan.</em>
      </h1>
      <p className="lead">
        No podemos confirmar la información ahora. Intenta otra vez en unos minutos.
      </p>
      <button className="button button-primary" onClick={() => reset()}>
        Volver a intentar
      </button>
    </section>
  );
}
