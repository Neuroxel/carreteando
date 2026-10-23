/**
 * Bienvenida: pantalla aparte (no dentro de la portada) con dos preguntas,
 * "¿Qué quieres hacer?" y "¿Dónde?". "Cuándo" es opcional (por defecto esta
 * noche). Los pasos son estado local: solo el final escribe una URL.
 */
import type { SlugIntencion } from './intenciones';

export const CLAVE_BIENVENIDA = 'dondesalgo-bienvenida';
export type Fecha = 'hoy' | 'manana' | 'finde' | 'futuro';
export type Donde = { tipo: 'cerca' } | { tipo: 'region' } | { tipo: 'comuna'; ciudad: string };
export interface EstadoBienvenida {
  paso: 'que' | 'donde';
  plan: SlugIntencion | null;
  fecha: Fecha;
  cambiandoCuando: boolean;
  /** Una transición en curso: mientras dura, ninguna otra elección se ejecuta (doble toque). */
  bloqueado: boolean;
}
export const INICIO: EstadoBienvenida = { paso: 'que', plan: null, fecha: 'hoy', cambiandoCuando: false, bloqueado: false };

export type Accion =
  | { tipo: 'tocar'; plan: SlugIntencion }
  | { tipo: 'elegir'; plan: SlugIntencion }
  | { tipo: 'bloquear' }
  | { tipo: 'desbloquear' }
  | { tipo: 'cambiarCuando' }
  | { tipo: 'cuando'; fecha: Fecha }
  | { tipo: 'volver' };
export function avanzar(s: EstadoBienvenida, a: Accion): EstadoBienvenida {
  switch (a.tipo) {
    case 'tocar':
      // Primer toque: marca la elección y bloquea; los siguientes se ignoran hasta el cambio de paso.
      return s.bloqueado || s.paso !== 'que' ? s : { ...s, plan: a.plan, bloqueado: true };
    case 'elegir':
      return { ...s, plan: a.plan, paso: 'donde', bloqueado: false };
    case 'bloquear':
      return { ...s, bloqueado: true };
    case 'desbloquear':
      return { ...s, bloqueado: false };
    case 'cambiarCuando':
      return { ...s, cambiandoCuando: !s.cambiandoCuando };
    case 'cuando':
      return { ...s, fecha: a.fecha, cambiandoCuando: false };
    case 'volver':
      return s.bloqueado ? s : { ...s, paso: 'que', cambiandoCuando: false };
  }
}

/** Solo en una entrada limpia a "/" y una vez por sesión; nunca por un enlace compartido. */
export function debeMostrar(p: { pathname: string; search: string; hash: string; vista: boolean }) {
  return p.pathname === '/' && !p.search && !p.hash && !p.vista;
}

/** Filtros finales: intención + dónde + cuándo (esta noche por defecto). */
export function filtrosFinales(s: EstadoBienvenida, d: Donde) {
  return {
    plan: s.plan,
    fecha: s.fecha,
    ciudad: d.tipo === 'comuna' ? d.ciudad : 'todos',
    cerca: d.tipo === 'cerca',
    zona: null,
  };
}

/** sessionStorage puede no existir o lanzar (modo privado): nunca rompe la portada. */
export const sesion = {
  vista(): boolean {
    try {
      return sessionStorage.getItem(CLAVE_BIENVENIDA) !== null;
    } catch {
      return true; // sin almacenamiento, mejor no insistir
    }
  },
  marcar(valor: 'vista' | 'completada' | 'omitida') {
    try {
      sessionStorage.setItem(CLAVE_BIENVENIDA, valor);
    } catch {
      /* sin almacenamiento */
    }
  },
};

/**
 * `?elegir=1` abre la bienvenida a pedido (QA, demos, "Ayúdame a elegir"
 * compartible) aunque ya se haya visto. Se consume: la URL queda sin él y el
 * resto del estado se conserva.
 */
export function leerElegir(search: string) {
  const p = new URLSearchParams(search);
  const forzar = p.get('elegir') === '1';
  p.delete('elegir');
  const q = p.toString();
  return { forzar, search: q ? `?${q}` : '' };
}

/**
 * Antes de pintar: si la bienvenida va a abrirse, se tapa la portada para que
 * no haya un destello HOME → BIENVENIDA. Mismas reglas que debeMostrar/leerElegir;
 * sin JavaScript no corre y la portada se ve normal. Nunca en una URL filtrada.
 */
export const SCRIPT_SIN_DESTELLO = `(function(){try{var l=location,f=/[?&]elegir=1(&|$)/.test(l.search),v=null;try{v=sessionStorage.getItem('${CLAVE_BIENVENIDA}')}catch(e){v='x'}if(l.pathname==='/'&&(f||(!l.search&&!l.hash&&v===null))){document.documentElement.classList.add('bv-pendiente');setTimeout(function(){document.documentElement.classList.remove('bv-pendiente')},4000)}}catch(e){}})();`;
