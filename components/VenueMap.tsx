'use client';
import { useEffect, useRef, useState } from 'react';
import { encuadre, type PuntoMapa } from '../lib/map';
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
  map: (el: HTMLElement, options: Record<string, unknown>) => {
    remove: () => void;
    fitBounds: (bounds: unknown, options: Record<string, unknown>) => void;
  };
  tileLayer: (url: string, options: Record<string, unknown>) => LeafletLayer;
  divIcon: (options: Record<string, unknown>) => unknown;
  marker: (
    position: [number, number],
    options: Record<string, unknown>,
  ) => { bindPopup: (html: string, options: Record<string, unknown>) => LeafletLayer };
  layerGroup: () => LeafletLayer;
  markerClusterGroup?: (options: Record<string, unknown>) => LeafletLayer;
  latLngBounds: (points: [number, number][]) => unknown;
};
const ESTADOS: Record<string, { label: string; className: string }> = {
  vivo: { label: 'Reportes ahora', className: 'punto-vivo' },
  fonda: { label: 'Fonda hoy', className: 'punto-fonda' },
  evento: { label: 'Con evento hoy', className: 'punto-evento' },
  lugar: { label: 'Lugar', className: 'punto-lugar' },
};
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
export default function VenueMap({ puntos }: { puntos: PuntoMapa[] }) {
  const contenedor = useRef<HTMLDivElement>(null);
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'error'>('cargando');
  useEffect(() => {
    let cancelado = false;
    let mapa: { remove: () => void } | null = null;
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
          const icono = L.divIcon({
            className: '',
            html: `<span class="mapa-punto ${ESTADOS[punto.estado].className}" style="--acento:${acento}" aria-hidden="true"></span>`,
            iconSize: [18, 18],
            iconAnchor: [9, 9],
          });
          L.marker([punto.lat, punto.lng], { icon: icono, title: punto.nombre })
            .bindPopup(ficha(punto), { maxWidth: 280, closeButton: true })
            .addTo(grupo);
        }
        grupo.addTo(instancia);
        if (puntos.length > 1) {
          const limites = L.latLngBounds(puntos.map((p) => [p.lat, p.lng]));
          instancia.fitBounds(limites, { padding: [28, 28], maxZoom: 15 });
        }
        setEstado('listo');
      } catch {
        if (!cancelado) setEstado('error');
      }
    })();
    return () => {
      cancelado = true;
      if (mapa) mapa.remove();
    };
  }, [puntos]);
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
              <span className={`mapa-punto ${ESTADOS[clave].className}`} aria-hidden="true" />
              {ESTADOS[clave].label} ({conteo[clave]})
            </li>
          ))}
      </ul>
    </div>
  );
}
