'use client';
import { useEffect, useRef, useState } from 'react';
import { encuadre, type PuntoMapa } from '../lib/map';
import { debeCentrar, type Posicion } from '../lib/radar';
import { track } from '../lib/metrics';
import { acentoDe } from '../lib/types';
import type { Territorio, TerritorioGeo } from '../lib/territorios';
const LEAFLET_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
const LEAFLET_JS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
const CLUSTER_CSS =
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/MarkerCluster.min.css';
const CLUSTER_JS =
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/leaflet.markercluster.min.js';
// Leaflet ships no types here and we only touch a handful of its surface.
type LeafletLayer = { addTo: (target: unknown) => LeafletLayer };
type LeafletGlobal = {
  map: (el: HTMLElement, options: Record<string, unknown>) => MapaLeaflet;
  tileLayer: (url: string, options: Record<string, unknown>) => LeafletLayer;
  divIcon: (options: Record<string, unknown>) => unknown;
  marker: (
    position: [number, number],
    options: Record<string, unknown>,
  ) => LeafletLayer & {
    bindPopup: (
      html: string,
      options: Record<string, unknown>,
    ) => LeafletLayer & { on: (evento: string, manejador: () => void) => void };
  };
  layerGroup: () => LeafletLayer;
  markerClusterGroup?: (options: Record<string, unknown>) => LeafletLayer;
  latLngBounds: (points: [number, number][]) => unknown;
  geoJSON: (
    data: unknown,
    options: Record<string, unknown>,
  ) => LeafletLayer & { setStyle: (s: (f: { properties: Territorio }) => Record<string, unknown>) => void };
};
type Grupo = { getAllChildMarkers: () => { options: { hoy?: boolean } }[] };
type MapaLeaflet = {
  remove: () => void;
  fitBounds: (bounds: unknown, options: Record<string, unknown>) => void;
  setView: (centro: [number, number], zoom: number, options?: Record<string, unknown>) => void;
  removeLayer: (capa: unknown) => void;
  getZoom: () => number;
  on: (evento: string, manejador: () => void) => void;
  off: (evento: string, manejador: () => void) => void;
};
/** Desde este zoom se dibujan los sectores; antes solo el activo y el tuyo. */
export const ZOOM_SECTORES = 13;
// "Carrete hoy" significa un evento confirmado para hoy; no medimos cuánta gente hay.
const ESTADOS: Record<string, { label: string; className: string }> = {
  vivo: { label: 'Con reportes de hoy', className: 'punto-vivo' },
  fonda: { label: 'Fonda hoy', className: 'punto-fonda' },
  evento: { label: 'Carrete hoy', className: 'punto-evento' },
  lugar: { label: 'Lugar', className: 'punto-lugar' },
};
/** Estrella de serigrafía: el marcador de un lugar con evento confirmado hoy. */
const ESTRELLA =
  '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 1.5l2.6 8.3 7.6-4.3-4.3 7.6 8.6 2.9-8.6 2.9 4.3 7.6-7.6-4.3L16 30.5l-2.6-8.3-7.6 4.3 4.3-7.6L1.5 16l8.6-2.9-4.3-7.6 7.6 4.3z"/></svg>';
const conEstrella = (estado: string) => estado === 'evento' || estado === 'fonda' || estado === 'vivo';
function cargar(tag: 'script' | 'link', href: string) {
  return new Promise<void>((resolve, reject) => {
    const selector = tag === 'script' ? `script[src="${href}"]` : `link[href="${href}"]`;
    if (document.querySelector(selector)) return resolve();
    const el = document.createElement(tag);
    if (tag === 'script') {
      (el as HTMLScriptElement).src = href;
      (el as HTMLScriptElement).async = true;
    } else {
      (el as HTMLLinkElement).rel = 'stylesheet';
      (el as HTMLLinkElement).href = href;
    }
    el.addEventListener('load', () => resolve());
    el.addEventListener('error', () => reject(new Error(href)));
    document.head.appendChild(el);
  });
}
function escapar(value: string) {
  return value.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );
}
function ficha(punto: PuntoMapa) {
  const noche = punto.estaNoche
    .map(
      (e) =>
        `<li><strong>${escapar(e.titulo)}</strong>${e.hora ? ` · ${escapar(e.hora)}` : ''}${
          e.precio ? ` · ${escapar(e.precio)}` : ''
        }</li>`,
    )
    .join('');
  const destino = encodeURIComponent(
    punto.direccion ? `${punto.direccion}, ${punto.ciudad}` : `${punto.lat},${punto.lng}`,
  );
  return `<div class="mapa-ficha">
    <p class="mapa-ficha-tipo">${escapar(punto.tipoLabel)}${punto.zona ? ` · ${escapar(punto.zona)}` : ''} · ${escapar(punto.ciudad)}</p>
    <h3><a href="/lugar/${escapar(punto.slug)}">${escapar(punto.nombre)}</a></h3>
    ${punto.vivo ? `<p class="mapa-ficha-vivo">${escapar(punto.vivo)}</p>` : ''}
    ${noche ? `<ul class="mapa-ficha-noche">${noche}</ul>` : '<p class="mapa-ficha-sin">Sin evento anunciado para hoy.</p>'}
    ${punto.proximos ? `<p class="mapa-ficha-sin">${punto.proximos} fecha${punto.proximos === 1 ? '' : 's'} más adelante.</p>` : ''}
    ${punto.precision === 'calle' ? '<p class="mapa-ficha-sin">Ubicación a nivel de calle.</p>' : ''}
    <p class="mapa-ficha-acciones">
      <a href="/lugar/${escapar(punto.slug)}">Ver lugar</a>
      <a href="https://www.openstreetmap.org/directions?to=${punto.lat}%2C${punto.lng}" target="_blank" rel="noopener noreferrer nofollow">Cómo llegar</a>
      ${punto.instagram ? `<a href="${escapar(punto.instagram)}" target="_blank" rel="noopener noreferrer nofollow">Instagram</a>` : ''}
    </p>
  </div>`;
}
export default function VenueMap({
  puntos,
  yo = null,
  territorios = null,
  aqui = null,
  zona = null,
  conteoZona,
  urlZona,
  fixValido = false,
  onPrecisar,
}: {
  puntos: PuntoMapa[];
  yo?: Posicion | null;
  territorios?: TerritorioGeo[] | null;
  aqui?: string | null;
  zona?: string | null;
  conteoZona?: (slug: string) => { eventos: number; lugares: number };
  urlZona?: (t: Territorio) => string;
  /** El fix actual sirve para recentrar (reciente y ≤500 m). */
  fixValido?: boolean;
  /** Pedir una ubicación mejor (viejo o muy impreciso). */
  onPrecisar?: () => void;
}) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<{ L: LeafletGlobal; mapa: MapaLeaflet } | null>(null);
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'error'>('cargando');
  // Sube cada vez que un mapa nuevo queda listo: al cambiar de capa el mapa se
  // reconstruye y la capa "Tú" tiene que volver a ponerse sobre el nuevo.
  const [version, setVersion] = useState(0);
  // Si la persona ya arrastró, hizo zoom o tocó el mapa, no se la recentra.
  const movidoPorPersona = useRef(false);
  useEffect(() => {
    const el = contenedor.current;
    if (!el) return;
    const marcar = () => {
      movidoPorPersona.current = true;
    };
    const eventos = ['pointerdown', 'wheel', 'touchstart', 'keydown'] as const;
    for (const ev of eventos) el.addEventListener(ev, marcar, { passive: true });
    return () => {
      for (const ev of eventos) el.removeEventListener(ev, marcar);
    };
  }, []);
  useEffect(() => {
    let cancelado = false;
    let mapa: MapaLeaflet | null = null;
    (async () => {
      try {
        await Promise.all([cargar('link', LEAFLET_CSS), cargar('link', CLUSTER_CSS)]);
        await cargar('script', LEAFLET_JS);
        await cargar('script', CLUSTER_JS);
        if (cancelado || !contenedor.current) return;
        const L = (window as unknown as { L?: LeafletGlobal }).L;
        if (!L) throw new Error('leaflet');
        const centro = encuadre(puntos);
        const instancia = L.map(contenedor.current, {
          center: [centro.lat, centro.lng],
          zoom: centro.zoom,
          scrollWheelZoom: false,
        });
        mapa = instancia;
        // CARTO's dark basemap now demands an API key, so the tiles come straight
        // from OpenStreetMap under its tile policy. The night look is a CSS
        // filter on our side: the served tile is never altered, and the
        // attribution stays legible over it.
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution:
            '&copy; colaboradores de <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(instancia);
        const grupo = L.markerClusterGroup
          ? L.markerClusterGroup({
              maxClusterRadius: 44,
              showCoverageOnHover: false,
              // Un grupo que esconde un carrete de hoy lo dice con la misma estrella.
              iconCreateFunction: (grupo: Grupo) => {
                const hijos = grupo.getAllChildMarkers();
                const conHoy = hijos.filter((m) => m.options.hoy).length;
                return L.divIcon({
                  className: '',
                  html: `<span class="mapa-grupo${conHoy ? ' mapa-grupo-hoy' : ''}" aria-hidden="true">${conHoy ? '<b>✦</b>' : ''}${hijos.length}</span>`,
                  iconSize: [36, 36],
                  iconAnchor: [18, 18],
                });
              },
            })
          : L.layerGroup();
        for (const punto of puntos) {
          const acento = acentoDe(punto.ciudad);
          const estrella = conEstrella(punto.estado);
          const icono = L.divIcon({
            className: '',
            html: estrella
              ? `<span class="mapa-estrella ${ESTADOS[punto.estado].className}" aria-hidden="true">${ESTRELLA}</span>`
              : `<span class="mapa-punto ${ESTADOS[punto.estado].className}" style="--acento:${acento}" aria-hidden="true"></span>`,
            iconSize: estrella ? [30, 30] : [14, 14],
            iconAnchor: estrella ? [15, 15] : [7, 7],
          });
          const marcador = L.marker([punto.lat, punto.lng], {
            icon: icono,
            title: estrella ? `${punto.nombre}: carrete hoy` : punto.nombre,
            zIndexOffset: estrella ? 500 : 0,
            hoy: estrella,
          })
            .bindPopup(ficha(punto), { maxWidth: 280, closeButton: true });
          marcador.on('popupopen', () => track('marker_open'));
          marcador.addTo(grupo);
        }
        grupo.addTo(instancia);
        if (puntos.length > 1) {
          const limites = L.latLngBounds(puntos.map((p) => [p.lat, p.lng]));
          instancia.fitBounds(limites, { padding: [28, 28], maxZoom: 15, animate: false });
        }
        mapaRef.current = { L, mapa: instancia };
        setEstado('listo');
        setVersion((v) => v + 1);
      } catch {
        if (!cancelado) setEstado('error');
      }
    })();
    return () => {
      cancelado = true;
      mapaRef.current = null;
      if (mapa) mapa.remove();
    };
  }, [puntos]);
  // La ubicación propia es otra capa: llega después y no redibuja el mapa.
  // Se vuelve a poner cada vez que el mapa se reconstruye (cambio de capa).
  useEffect(() => {
    const ref = mapaRef.current;
    if (!ref || !yo) return;
    const marca = ref.L.marker([yo.lat, yo.lng], {
      icon: ref.L.divIcon({ className: '', html: '<span class="mapa-yo" aria-hidden="true"></span>', iconSize: [22, 22], iconAnchor: [11, 11] }),
      title: 'Tu ubicación',
      keyboard: false,
      zIndexOffset: 1000,
    });
    marca.addTo(ref.mapa);
    if (debeCentrar(yo, puntos, movidoPorPersona.current)) ref.mapa.setView([yo.lat, yo.lng], 14, { animate: false });
    return () => ref.mapa.removeLayer(marca);
  }, [yo, version, puntos]);
  // Sectores verificados: trazo discreto que no compite con los eventos. Lejos,
  // solo la zona elegida y la tuya; de cerca, todos. Sin etiquetas fijas.
  const conteoRef = useRef(conteoZona);
  conteoRef.current = conteoZona;
  const urlRef = useRef(urlZona);
  urlRef.current = urlZona;
  useEffect(() => {
    const ref = mapaRef.current;
    if (!ref || !territorios?.length) return;
    const destacado = (t: Territorio) => t.slug === zona || t.slug === aqui;
    const estilo = (f: { properties: Territorio }) => {
      const cerca = ref.mapa.getZoom() >= ZOOM_SECTORES;
      const d = destacado(f.properties);
      if (!cerca && !d) return { opacity: 0, fillOpacity: 0, interactive: false };
      return {
        color: '#b6a6ff',
        weight: d ? 2 : 1,
        opacity: d ? 0.8 : 0.35,
        dashArray: d ? undefined : '3 4',
        fillColor: '#b6a6ff',
        fillOpacity: d ? 0.12 : 0.03,
      };
    };
    const capa = ref.L.geoJSON(
      { type: 'FeatureCollection', features: territorios },
      {
        style: estilo,
        onEachFeature: (f: { properties: Territorio }, layer: { bindPopup: (html: () => string) => void }) =>
          layer.bindPopup(() => {
            const t = f.properties;
            const c = conteoRef.current?.(t.slug) || { eventos: 0, lugares: 0 };
            const url = urlRef.current?.(t);
            return `<strong>${escapar(t.nombre)}</strong><br>${c.eventos} ${c.eventos === 1 ? 'carrete' : 'carretes'} hoy · ${c.lugares} ${c.lugares === 1 ? 'lugar' : 'lugares'}${
              url ? `<br><a href="${escapar(url)}">Ver esta zona</a>` : ''
            }<br><small>Límites: ${escapar(t.source.split(' — ')[0])}</small>`;
          }),
      },
    );
    capa.addTo(ref.mapa);
    const restyle = () => capa.setStyle(estilo);
    ref.mapa.on('zoomend', restyle);
    return () => {
      ref.mapa.off('zoomend', restyle);
      ref.mapa.removeLayer(capa);
    };
  }, [territorios, version, zona, aqui]);
  // "Mi ubicación": recentra con un fix bueno; si es viejo o muy impreciso, vuelve a precisar.
  const miUbicacion = () => {
    const ref = mapaRef.current;
    if (yo && fixValido && ref) {
      movidoPorPersona.current = false;
      ref.mapa.setView([yo.lat, yo.lng], 15, { animate: false });
    } else onPrecisar?.();
  };
  const conteo = puntos.reduce<Record<string, number>>((acc, p) => {
    acc[p.estado] = (acc[p.estado] || 0) + 1;
    return acc;
  }, {});
  return (
    <div className="mapa-bloque">
      {estado === 'error' && (
        <p role="alert" className="form-error">
          No se pudo cargar el mapa. La lista de arriba sigue funcionando.
        </p>
      )}
      <div
        ref={contenedor}
        className="mapa-lienzo"
        role="application"
        aria-label={`Mapa con ${puntos.length} lugares de la Región de Valparaíso`}
      >
        {estado === 'cargando' && <p className="mapa-cargando">Cargando el mapa…</p>}
      </div>
      {(yo || onPrecisar) && estado === 'listo' && (
        <button type="button" className="mapa-mi-ubicacion" onClick={miUbicacion}>
          <span aria-hidden="true">◎</span> Mi ubicación
        </button>
      )}
      <ul className="mapa-leyenda">
        {(['vivo', 'fonda', 'evento', 'lugar'] as const)
          .filter((clave) => conteo[clave])
          .map((clave) => (
            <li key={clave}>
              {conEstrella(clave) ? (
                <span className={`mapa-estrella mapa-estrella-leyenda ${ESTADOS[clave].className}`} aria-hidden="true" dangerouslySetInnerHTML={{ __html: ESTRELLA }} />
              ) : (
                <span className={`mapa-punto ${ESTADOS[clave].className}`} aria-hidden="true" />
              )}
              {ESTADOS[clave].label} ({conteo[clave]})
            </li>
          ))}
        {yo && (
          <li>
            <span className="mapa-yo" aria-hidden="true" /> Tú
          </li>
        )}
      </ul>
    </div>
  );
}
