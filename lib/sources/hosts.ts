/**
 * Hosts exactos que los adaptadores de ruta pueden leer. Nada de comodines:
 * `*.evently.cl` abriría la puerta a cualquier productora de la plataforma.
 * Sumar un local es sumar su subdominio aquí, revisado a mano.
 */
export const VESTI_HOSTS = ['vesti.cl', 'www.vesti.cl'] as const;
export const EVENTLY_HOSTS = ['wooclub.evently.cl'] as const;
export const hostVesti = (h: string) => (VESTI_HOSTS as readonly string[]).includes(h);
export const hostEvently = (h: string) => (EVENTLY_HOSTS as readonly string[]).includes(h);
