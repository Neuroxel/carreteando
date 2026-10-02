import type { Categoria, TipoEvento } from './types';
const plano = (v: string) =>
  v
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ');
/**
 * Qué clase de noche es, cuando la fuente no lo dice. Solo se afirma lo que
 * el texto respalda; si no hay señal, queda sin tipo (y la tarjeta muestra el
 * estilo), nunca un "Otro" de relleno.
 */
export function inferTipo(texto: string, categoria?: Categoria): TipoEvento {
  const t = ` ${plano(texto)} `;
  if (/ (fonda|ramada|fondazo) /.test(t)) return 'fonda';
  if (/ tocatas? /.test(t)) return 'tocata';
  if (/ (pena|penas) /.test(t)) return 'pena';
  if (/ (mechoneo|fiesta universitaria|viernes universitario|bienvenida mechon|semana mechona) /.test(t) || categoria === 'universitario')
    return 'fiesta_universitaria';
  if (/ (festival|fest|festilambe) /.test(t)) return 'festival';
  if (/ after /.test(t)) return 'after';
  if (/ (fiesta|party|dj|djs|techno|house|perreo|rave|retro|club night|reggaeton|cumbia night) /.test(t)) return 'club';
  if (/ (concierto|en vivo|show|gira|tour|tributo|banda|orquesta|trio|quinteto|cuarteto|octeto|lanzamiento|disco|sinfonia|recital|jazz) /.test(t))
    return 'concierto';
  if (/ (teatro|obra|cine|stand up|standup|comedia|circo|circense|variete|danza|poesia|cabaret|drag) /.test(t)) return 'noche_cultural';
  if (/ (karaoke|happy hour|bar) /.test(t)) return 'bar';
  return 'main';
}
