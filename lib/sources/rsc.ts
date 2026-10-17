/**
 * Vesti y Evently son apps de Next.js: los datos de la página viajan en el
 * HTML como trozos `self.__next_f.push([1,"…"])`. Se leen tal cual, sin
 * ejecutar JavaScript ni llamar APIs privadas.
 */
const PUSH = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g;
export function textoRsc(html: string) {
  let salida = '';
  for (const m of html.matchAll(PUSH)) {
    try {
      salida += JSON.parse(`"${m[1]}"`);
    } catch {
      /* un trozo mal formado no invalida los demás */
    }
  }
  return salida;
}

/** El valor JSON (objeto o arreglo) que empieza en `desde`, respetando llaves dentro de strings. */
export function valorDesde(texto: string, desde: number): unknown {
  let profundidad = 0;
  let enString = false;
  for (let i = desde; i < texto.length; i++) {
    const c = texto[i];
    if (enString) {
      if (c === '\\') i++;
      else if (c === '"') enString = false;
      continue;
    }
    if (c === '"') enString = true;
    else if (c === '[' || c === '{') profundidad++;
    else if (c === ']' || c === '}') {
      profundidad--;
      if (profundidad === 0) {
        try {
          return JSON.parse(texto.slice(desde, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/** El arreglo JSON que sigue a `"clave":[`. */
export function arregloTrasClave(texto: string, clave: string): unknown[] | null {
  const inicio = texto.indexOf(`"${clave}":[`);
  if (inicio < 0) return null;
  const valor = valorDesde(texto, texto.indexOf('[', inicio));
  return Array.isArray(valor) ? valor : null;
}

/** Fecha y hora en Chile de un instante ISO en UTC ("2026-10-18T01:00:00Z" → 17-oct 22:00). */
export function fechaHoraChile(iso: string): { date: string; time: string } | null {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Santiago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(t))
      .map((p) => [p.type, p.value]),
  );
  return { date: `${partes.year}-${partes.month}-${partes.day}`, time: `${partes.hour}:${partes.minute}` };
}
