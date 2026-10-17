'use client';
import { useEffect, useRef, useState } from 'react';
import { encuadre, type PuntoMapa } from '../lib/map';
import { distanciaKm, type Posicion } from '../lib/radar';
import { track } from '../lib/metrics';
import { acentoDe } from '../lib/types';
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
};
type MapaLeaflet = {
  remove: () => void;
  fitBounds: (bounds: unknown, options: Record<string, unknown>) => void;
  setView: (centro: [number, number], zoom: number, options?: Record<string, unknown>) => void;
  removeLayer: (capa: unknown) => void;
};
// "Carrete hoy" significa un evento confirmado para hoy; no medimos cuánta gente hay.
const ESTADOS: Record<string, { label: string; className: string }> = {
  vivo: { label: 'Con reportes de hoy', className: 'punto-vivo' },
  fonda: { label: 'Fonda hoy', className: 'punto-fonda' },
  evento: { label: 'Carrete hoy', className: 'punto-evento' },
  lugar: { label: 'Boliche', className: 'punto-lugar' },
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
export default function VenueMap({ puntos, yo = null }: { puntos: PuntoMapa[]; yo?: Posicion | null }) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<{ L: LeafletGlobal; mapa: MapaLeaflet } | null>(null);
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'error'>('cargando');
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
          ? L.markerClusterGroup({ maxClusterRadius: 44, showCoverageOnHover: false })
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
          })
            .bindPopup(ficha(punto), { maxWidth: 280, closeButton: true });
          marcador.on('popupopen', () => track('marker_open'));
          marcador.addTo(grupo);
        }
        grupo.addTo(instancia);
        if (puntos.length > 1) {
          const limites = L.latLngBounds(puntos.map((p) => [p.lat, p.lng]));
          instancia.fitBounds(limites, { padding: [28, 28], maxZoom: 15 });
        }
        mapaRef.current = { L, mapa: instancia };
        setEstado('listo');
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
  const centrado = useRef(false);
  useEffect(() => {
    const ref = mapaRef.current;
    if (!ref || !yo || estado !== 'listo') return;
    const marca = ref.L.marker([yo.lat, yo.lng], {
      icon: ref.L.divIcon({ className: '', html: '<span class="mapa-yo" aria-hidden="true"></span>', iconSize: [22, 22], iconAnchor: [11, 11] }),
      title: 'Tu ubicación',
      keyboard: false,
      zIndexOffset: 1000,
    });
    marca.addTo(ref.mapa);
    // Se centra una vez, y solo si hay algo dentro de 30 km: fuera de la región no sirve.
    if (!centrado.current && puntos.some((p) => distanciaKm(yo, p) < 30)) {
      centrado.current = true;
      ref.mapa.setView([yo.lat, yo.lng], 14, { animate: false });
    }
    return () => ref.mapa.removeLayer(marca);
  }, [yo, estado, puntos]);
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
