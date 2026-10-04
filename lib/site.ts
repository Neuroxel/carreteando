const PRODUCCION = 'https://carreteando.vercel.app';
/**
 * La dirección pública sale de la configuración, no del código: el día que
 * haya dominio propio basta con cambiar NEXT_PUBLIC_SITE_URL y volver a
 * desplegar. Un valor mal escrito no puede convertir los canónicos en basura:
 * se cae a la dirección actual.
 */
export function siteUrlFrom(value: string | undefined) {
  if (!value) return PRODUCCION;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.pathname.replace(/\/$/, '') || url.search || url.hash) return PRODUCCION;
    return url.origin;
  } catch {
    return PRODUCCION;
  }
}
export const SITE_URL = siteUrlFrom(process.env.NEXT_PUBLIC_SITE_URL);
export const SITE_DESCRIPTION =
  'Eventos y lugares para salir hoy en Valparaíso, Viña del Mar y alrededores: fiestas, bares, música en vivo y más, con la fuente de cada dato.';
