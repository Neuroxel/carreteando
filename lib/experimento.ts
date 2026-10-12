/**
 * Edición experimental "3D culto" (proyecto aparte en Vercel). Con la bandera
 * puesta el sitio no se indexa y no anuncia su sitemap: es una prueba A/B, no
 * otra versión pública que compita con la principal.
 */
export const EXPERIMENTO = process.env.NEXT_PUBLIC_EXPERIMENT === '1';
