import { ValidationError, validateSubmission } from './submission-validation';
import { eventKey } from './event-identity';
import { safeImageUrl } from './safety';
import { addDays, fechaDeLaNoche } from './event-extraction';
import { ahoraEnChile, sigueTrasCorte } from './temporal';
export const REVIEW_KINDS = ['event', 'inbox'];
export const REVIEW_ACTIONS = ['approve', 'save', 'reject', 'withdraw', 'resolve'];
// A failed review must say which half failed. Reporting every cause as "invalid"
// hid a real defect: the submit button's name/value never reached the action.
export class ReviewInputError extends Error {
  constructor(
    readonly status: string,
    readonly detail?: string,
  ) {
    super(detail || status);
  }
}
export function reviewInput(
  kind: string,
  action: string,
  revision: number,
  form: Pick<FormData, 'get' | 'entries'>,
) {
  if (
    !REVIEW_KINDS.includes(kind) ||
    !REVIEW_ACTIONS.includes(action) ||
    !Number.isSafeInteger(revision) ||
    revision < 0
  )
    throw new ReviewInputError('invalid');
  const note = String(form.get('note') || '').trim();
  if (note.length < 10 || note.length > 1000) throw new ReviewInputError('invalid-note');
  if (action !== 'approve' && action !== 'save') return { note, fields: {} };
  if (form.get('checked') !== 'yes') throw new ReviewInputError('invalid-check');
  let v: ReturnType<typeof validateSubmission>;
  try {
    const raw = Object.fromEntries(form.entries()) as Record<string, unknown>;
    // Moderar no es aportar: el organizador y la descripción son deseables, no
    // requisitos. Lo que sí sigue siendo obligatorio es dónde, cuándo y la fuente.
    const ahora = new Date();
    v = validateSubmission({ ...raw, precio: raw.precio === '' ? null : Number(raw.precio) }, ahora, {
      organizadorMin: 0,
      descripcionMin: 0,
      fechaMinima: fechaMinimaRevision(raw, ahora),
    });
  } catch (error) {
    // Un rechazo que no dice qué campo revisar es indistinguible de un producto roto.
    throw new ReviewInputError(
      'invalid-fields',
      error instanceof ValidationError ? error.message : undefined,
    );
  }
  const finValue = form.get('fin');
  const fin = finValue === null ? undefined : String(finValue).trim();
  if (fin && (!/^([01]\d|2[0-3]):[0-5]\d$/.test(fin) || !v.hora || fin === v.hora))
    throw new ReviewInputError('invalid-fields', 'La hora de término requiere una hora de inicio distinta y una fuente verificable.');
  return {
      note,
      fields: {
        title: v.nombre,
        description: v.descripcion,
        date_text: v.fecha,
        event_time: v.hora,
        event_end_time: fin === undefined ? undefined : fin || null,
        venue: v.lugar,
        city: v.ciudad,
        address: v.direccion,
        price_clp: v.precio,
        price_text:
          v.precio_texto ||
          (v.precio === null
            ? 'Precio por confirmar'
            : v.precio === 0
              ? 'Gratis'
              : `$${v.precio.toLocaleString('es-CL')}`),
        category: v.categoria,
        instagram_url: v.fuente_url,
        image_url: safeImageUrl(v.imagen_url),
        username: v.organizador,
        event_key: eventKey(`${v.lugar} ${v.ciudad}`, v.fecha, v.nombre),
      },
  };
}

/**
 * Misma regla que la guarda de review_item (DB): se revisa desde la fecha de la
 * noche (corte 05:00) y, después del corte, también la noche anterior si su fin
 * verificado todavía no llega.
 */
export function fechaMinimaRevision(raw: Record<string, unknown>, ahora: Date) {
  const noche = fechaDeLaNoche(ahora);
  const anterior = addDays(noche, -1);
  const fecha = typeof raw.fecha === 'string' ? raw.fecha : '';
  const hora = typeof raw.hora === 'string' ? raw.hora.trim() : '';
  const fin = typeof raw.fin === 'string' ? raw.fin.trim() : '';
  return fecha === anterior && sigueTrasCorte({ fecha, hora, fin }, ahoraEnChile(ahora)) ? anterior : noche;
}
