/**
 * Hosts exactos que los adaptadores de ruta pueden leer. Nada de comodines:
 * `*.evently.cl` abriría la puerta a cualquier productora de la plataforma.
 * Sumar un local es sumar su subdominio aquí, revisado a mano.
 */
export const VESTI_HOSTS = ['vesti.cl', 'www.vesti.cl'] as const;
// Subdominios exactos verificados a mano (nunca *.evently.cl). 23-oct: chicagobar, terrazamiaw.
export const EVENTLY_HOSTS = ['wooclub.evently.cl', 'chicagobar.evently.cl', 'terrazamiaw.evently.cl'] as const;
export const hostVesti = (h: string) => (VESTI_HOSTS as readonly string[]).includes(h);
export const hostEvently = (h: string) => (EVENTLY_HOSTS as readonly string[]).includes(h);
