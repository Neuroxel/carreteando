import { addDays, normalizeText, toChileDateString, validIsoDate } from './event-extraction';
import { CATEGORIAS, CIUDADES } from './types';
import { safeWebUrl } from './safety';
export class ValidationError extends Error {}
function text(body: Record<string, unknown>, key: string, max: number, min = 0): string {
  const value = body[key] ?? '';
  if (
    typeof value !== 'string' ||
    value.length > max ||
    value.trim().length < min ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)
  )
    throw new ValidationError(`Revisa el campo ${key}.`);
  return value.trim();
}
function url(body: Record<string, unknown>, key: string, required = false): string | null {
  const value = text(body, key, 1200, required ? 1 : 0);
  if (!value) return null;
  const safe = safeWebUrl(value);
  if (!safe) throw new ValidationError(`Usa una URL http o https válida en ${key}.`);
  return safe;
}
export function validateSubmission(value: unknown, now = new Date()) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new ValidationError('Solicitud inválida.');
  const b = value as Record<string, unknown>;
  if (text(b, 'website', 1000)) throw new ValidationError('No se pudo recibir el evento.');
  const fecha = text(b, 'fecha', 10, 10),
    today = toChileDateString(now);
  if (!validIsoDate(fecha) || fecha < today || fecha > addDays(today, 180))
    throw new ValidationError('La fecha debe ser válida, desde hoy hasta los próximos 180 días.');
  const hora = text(b, 'hora', 5);
  if (hora && !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) throw new ValidationError('Revisa la hora.');
  const ciudad = text(b, 'ciudad', 60, 1);
  if (!CIUDADES.includes(ciudad))
    throw new ValidationError('Selecciona una zona de la Región de Valparaíso.');
  const categoria = text(b, 'categoria', 30, 1);
  if (!CATEGORIAS.some((c) => c.value === categoria))
    throw new ValidationError('Selecciona un tipo de carrete.');
  const price = b.precio === '' || b.precio === null || b.precio === undefined ? null : b.precio;
  if (
    price !== null &&
    (typeof price !== 'number' || !Number.isInteger(price) || price < 0 || price > 500000)
  )
    throw new ValidationError('Revisa el precio en pesos chilenos.');
  return {
    nombre: text(b, 'nombre', 160, 4),
    descripcion: text(b, 'descripcion', 3500, 20),
    fecha,
    hora: hora || null,
    lugar: text(b, 'lugar', 160, 3),
    ciudad,
    sector: text(b, 'sector', 120),
    direccion: text(b, 'direccion', 240),
    precio: price,
    precio_texto: text(b, 'precio_texto', 160),
    categoria,
    organizador: text(b, 'organizador', 100, 2),
    fuente_url: url(b, 'fuente_url', true),
    organizador_url: url(b, 'organizador_url'),
    imagen_url: url(b, 'imagen_url'),
  };
}
export function submissionIdentity(value: ReturnType<typeof validateSubmission>): string {
  return normalizeText(`${value.nombre}|${value.fecha}|${value.lugar}|${value.ciudad}`)
    .replace(/\s+/g, ' ')
    .trim();
}
export function validateReport(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new ValidationError('Solicitud inválida.');
  const b = value as Record<string, unknown>;
  if (text(b, 'website', 1000)) throw new ValidationError('Solicitud inválida.');
  const evento = text(b, 'evento', 120, 1);
  if (!/^[a-zA-Z0-9_-]+$/.test(evento)) throw new ValidationError('Identificador inválido.');
  const motivo = text(b, 'motivo', 40, 1);
  if (!['fecha', 'lugar', 'precio', 'cancelado', 'duplicado', 'fuente', 'otro'].includes(motivo))
    throw new ValidationError('Selecciona un motivo.');
  return { evento, motivo, detalle: text(b, 'detalle', 1000, 10) };
}
