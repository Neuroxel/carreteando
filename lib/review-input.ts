import { validateSubmission } from './submission-validation';
import { eventKey } from './event-identity';
import { safeImageUrl } from './safety';
export const REVIEW_KINDS = ['event', 'inbox'];
export const REVIEW_ACTIONS = ['approve', 'save', 'reject', 'withdraw', 'resolve'];
// A failed review must say which half failed. Reporting every cause as "invalid"
// hid a real defect: the submit button's name/value never reached the action.
export class ReviewInputError extends Error {
  constructor(readonly status: string) {
    super(status);
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
  try {
    const raw = Object.fromEntries(form.entries()) as Record<string, unknown>;
    const v = validateSubmission({ ...raw, precio: raw.precio === '' ? null : Number(raw.precio) });
    return {
      note,
      fields: {
        title: v.nombre,
        description: v.descripcion,
        date_text: v.fecha,
        event_time: v.hora,
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
  } catch {
    throw new ReviewInputError('invalid-fields');
  }
}
