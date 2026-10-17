import datos from '../data/venue-routes.json';
import { eventlyAgenda } from './sources/adapters/evently';
import { vestiCompany } from './sources/adapters/vesti';
import { hostEvently, hostVesti } from './sources/hosts';
import type { SourceDefinition } from './sources/types';

export const TIPOS_RUTA = ['vesti_company', 'evently_agenda', 'portaldisc_cartelera', 'passline_venue', 'ecopass', 'instagram', 'sitio_oficial'] as const;
export type TipoRuta = (typeof TIPOS_RUTA)[number];
export type Acceso = 'auto' | 'manual' | 'bloqueado';
export interface Ruta {
  tipo: TipoRuta;
  url: string;
  acceso: Acceso;
  verificada: string;
  nota?: string;
}
export interface RutasLocal {
  slug: string;
  nombre: string;
  comuna: string;
  rutas: Ruta[];
}

/** Solo estos tipos tienen adaptador; cada uno exige su host exacto. */
const LECTORES: Partial<Record<TipoRuta, { adapter: string; host: (h: string) => boolean; sourceType: SourceDefinition['sourceType']; etiqueta: string }>> = {
  vesti_company: { adapter: vestiCompany.id, host: hostVesti, sourceType: 'VESTI', etiqueta: 'perfil Vesti' },
  evently_agenda: { adapter: eventlyAgenda.id, host: hostEvently, sourceType: 'TICKET_PLATFORM', etiqueta: 'agenda Evently' },
};

/** Errores de forma, para que una ruta mal escrita falle en las pruebas y no de noche. */
export function validarRutas(locales: RutasLocal[]): string[] {
  const errores: string[] = [];
  const urls = new Set<string>();
  for (const l of locales) {
    if (!/^[a-z0-9-]{3,80}$/.test(l.slug)) errores.push(`${l.slug}: slug inválido`);
    if (!l.rutas.length) errores.push(`${l.slug}: sin rutas`);
    for (const r of l.rutas) {
      const donde = `${l.slug} ${r.tipo}`;
      if (!TIPOS_RUTA.includes(r.tipo)) errores.push(`${donde}: tipo desconocido`);
      if (!['auto', 'manual', 'bloqueado'].includes(r.acceso)) errores.push(`${donde}: acceso inválido`);
      if (r.acceso !== 'auto' && !r.nota) errores.push(`${donde}: un acceso manual o bloqueado necesita su motivo`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(r.verificada)) errores.push(`${donde}: fecha de verificación inválida`);
      let u: URL;
      try {
        u = new URL(r.url);
      } catch {
        errores.push(`${donde}: URL inválida`);
        continue;
      }
      if (u.protocol !== 'https:') errores.push(`${donde}: solo https`);
      if (urls.has(r.url)) errores.push(`${donde}: URL repetida`);
      urls.add(r.url);
      const lector = LECTORES[r.tipo];
      if (r.acceso === 'auto' && !lector) errores.push(`${donde}: sin adaptador, no puede ser automática`);
      if (lector && !lector.host(u.hostname)) errores.push(`${donde}: host ${u.hostname} fuera de la lista exacta`);
    }
  }
  return errores;
}

export const RUTAS_LOCALES: RutasLocal[] = (datos as { locales: RutasLocal[] }).locales;

/**
 * Fuentes nuevas que salen de las rutas automáticas. Entran con confianza
 * `review`: lo que encuentren va a la cola privada y lo decide el motor o una
 * persona, nunca se publica solo. Una ruta cuya URL ya está en el registro no
 * se duplica.
 */
export function fuentesDeRutas(existentes: SourceDefinition[], locales = RUTAS_LOCALES): SourceDefinition[] {
  const ya = new Set(existentes.map((s) => s.publicUrl));
  const salida: SourceDefinition[] = [];
  for (const l of locales)
    for (const r of l.rutas) {
      const lector = LECTORES[r.tipo];
      if (r.acceso !== 'auto' || !lector || ya.has(r.url)) continue;
      salida.push({
        id: `ruta-${r.tipo.replace('_', '-')}-${l.slug}`.slice(0, 80),
        name: `${l.nombre} · ${lector.etiqueta}`,
        sourceType: lector.sourceType,
        adapter: lector.adapter,
        publicUrl: r.url,
        commune: l.comuna,
        venueSlug: l.slug,
        venueName: l.nombre,
        trust: 'review',
        family: 'TICKET_PLATFORM',
        tier: 'B',
        accessMode: 'html',
        refreshHours: 24,
      });
      ya.add(r.url);
    }
  return salida;
}
