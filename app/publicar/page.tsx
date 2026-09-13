import SubmissionForm from '../../components/SubmissionForm';
import { toChileDateString } from '../../lib/event-extraction';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Propón un evento', alternates: { canonical: '/publicar' } };
export default function Publish() {
  return (
    <section className="container narrow page-section">
      <p className="eyebrow">COMUNIDAD / ORGANIZADORES</p>
      <h1>
        Pasa <em>el dato.</em>
      </h1>
      <p className="lead">
        ¿Fiesta, tocata o una noche que vale la pena? Envíanos los detalles y la fuente. Revisamos
        cada propuesta antes de publicarla.
      </p>
      <SubmissionForm today={toChileDateString(new Date())} />
    </section>
  );
}
