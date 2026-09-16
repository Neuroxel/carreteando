/**
 * Los únicos dominios desde los que se muestra una imagen. Existe para que una
 * URL cualquiera no termine renderizada, y tiene que coincidir con
 * `remotePatterns` de next.config.mjs: cuando derivaron, los carteles oficiales
 * de los propios locales se descartaban en silencio y nadie se enteraba.
 * `tests/imagenes.test.ts` vigila que las dos listas digan lo mismo.
 */
export const IMAGE_HOST_SUFFIXES = ['cdninstagram.com', 'fbcdn.net'];
export const IMAGE_HOSTS = [
  // Ticketeras y plataformas de eventos
  'images.portaldisc.com',
  'imagenes.passline.com',
  'ticketing-uploads-1.ticketplus.global',
  'events-cdn.vesti.cl',
  'images.unsplash.com',
  // Sitios oficiales de los propios lugares: el cartel que publica el local
  'parquecultural.cl',
  'cinzanooficial.cl',
  // Municipios: gráfica oficial de fondas y actividades públicas
  'municipalidaddevalparaiso.cl',
  'www.municipalidaddevalparaiso.cl',
  'www.munivina.cl',
  'lacalera.cl',
];
export function hostPermitido(hostname: string) {
  return (
    IMAGE_HOSTS.includes(hostname) ||
    IMAGE_HOST_SUFFIXES.some((s) => hostname === s || hostname.endsWith(`.${s}`))
  );
}
