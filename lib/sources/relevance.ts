/**
 * Las fuentes universitarias y culturales traen mucho ruido: el calendario de
 * USM tenía 27 eventos próximos y casi ninguno era salir de noche (talleres a
 * las 12:30, seminarios a las 09:00, ferias). Este clasificador es
 * determinista a propósito: barato, auditable y sin un modelo de lenguaje por
 * evento. Combina señales; ninguna palabra sola decide.
 */
export type Relevancia = 'NIGHTLIFE_HIGH' | 'CULTURAL_NIGHT' | 'REVIEW' | 'IRRELEVANT';
const NOCHE = [
  'fiesta', 'party', 'tocata', 'pena', 'karaoke', 'dj', 'after', 'carrete',
  'baile', 'bailable', 'cumbia', 'reggaeton', 'techno', 'house', 'electronica', 'rave',
  'perreo', 'salsa', 'fonda', 'ramada', 'bienvenida', 'mechoneo', 'tambores',
];
const CULTURA = [
  'concierto', 'musica en vivo', 'en vivo', 'show', 'festival', 'banda', 'trio', 'cuarteto',
  'octeto', 'orquesta', 'jazz', 'rock', 'punk', 'metal', 'folk', 'cueca', 'bolero', 'tango',
  'teatro', 'obra', 'stand up', 'standup', 'comedia', 'cine', 'ciclo', 'lanzamiento',
  'disco', 'gira', 'tributo', 'recital', 'noche', 'cabaret', 'drag',
  'carnaval', 'pasacalle', 'pasacalles', 'comparsa', 'comparsas', 'murga', 'batucada',
];
const ACADEMICO = [
  'seminario', 'congreso', 'conferencia', 'charla', 'taller', 'workshop', 'curso',
  'ceremonia', 'titulacion', 'graduacion', 'feria laboral', 'feria de empleo', 'expotec',
  'simposio', 'coloquio', 'jornada', 'capacitacion', 'postulacion', 'admision', 'webinar',
  'defensa de tesis', 'investigacion', 'reunion anual', 'encuentro academico', 'inauguracion',
  'feria de salud', 'gobierno en terreno', 'prevencion', 'yoga',
];
function normalizedTitle(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function contiene(texto: string, palabras: string[]) {
  return palabras.filter((p) => new RegExp(`(^|\\s)${p}(\\s|$)`).test(texto));
}
export function clasificar(input: {
  titulo: string;
  descripcion?: string | null;
  hora?: string | null;
  horaFin?: string | null;
  categorias?: string[];
}): { relevancia: Relevancia; razones: string[]; academico: boolean; salida: boolean } {
  const titulo = normalizedTitle(input.titulo);
  const todo = normalizedTitle(
    `${input.titulo} ${input.descripcion || ''} ${(input.categorias || []).join(' ')}`,
  );
  const razones: string[] = [];
  const noche = contiene(todo, NOCHE);
  const cultura = contiene(todo, CULTURA);
  // Lo académico se mira sobre todo en el título: una descripción de concierto
  // puede mencionar "taller" sin que el evento lo sea.
  const academico = contiene(titulo, ACADEMICO);
  const hora = input.hora && /^\d{2}:\d{2}/.test(input.hora) ? input.hora.slice(0, 5) : null;
  const deNoche = hora !== null && hora >= '18:00';
  const deDia = hora !== null && hora < '17:00';
  const terminaTemprano = input.horaFin && /^\d{2}:\d{2}/.test(input.horaFin) && input.horaFin < '18:00';
  if (noche.length) razones.push(`señal de noche: ${noche.slice(0, 3).join(', ')}`);
  if (cultura.length) razones.push(`señal cultural: ${cultura.slice(0, 3).join(', ')}`);
  if (academico.length) razones.push(`señal académica: ${academico.slice(0, 3).join(', ')}`);
  if (hora) razones.push(`empieza ${hora}`);
  // Señal de salida: música, fiesta, festival, carnaval. Hace útil algo de día
  // (un festival a las 16:00) sin volverlo "nocturno".
  const salida = noche.length + cultura.length > 0 && !(academico.length > 0 && noche.length === 0);
  const r = (relevancia: Relevancia) => ({ relevancia, razones, academico: academico.length > 0 && noche.length === 0, salida });
  // Académico de día: fuera, sin pasar por la cola.
  if (academico.length && !noche.length && (deDia || terminaTemprano || !hora))
    return r('IRRELEVANT');
  if (noche.length && (deNoche || !hora)) return r('NIGHTLIFE_HIGH');
  if (cultura.length && deNoche && !academico.length)
    return r('CULTURAL_NIGHT');
  if (noche.length && deDia) return r('REVIEW'); // una fonda diurna puede valer
  if (academico.length) return r('IRRELEVANT');
  if (deDia && !cultura.length) return r('IRRELEVANT');
  return r('REVIEW');
}
