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
}
export const INICIO: EstadoBienvenida = { paso: 'que', plan: null, fecha: 'hoy', cambiandoCuando: false };

export type Accion = { tipo: 'elegir'; plan: SlugIntencion } | { tipo: 'cambiarCuando' } | { tipo: 'cuando'; fecha: Fecha } | { tipo: 'volver' };
export function avanzar(s: EstadoBienvenida, a: Accion): EstadoBienvenida {
  switch (a.tipo) {
    case 'elegir':
      return { ...s, plan: a.plan, paso: 'donde' };
    case 'cambiarCuando':
      return { ...s, cambiandoCuando: !s.cambiandoCuando };
    case 'cuando':
      return { ...s, fecha: a.fecha, cambiandoCuando: false };
    case 'volver':
      return { ...s, paso: 'que' };
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
