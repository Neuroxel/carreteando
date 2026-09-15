import assert from 'node:assert/strict';
import test from 'node:test';
import { encuadre, normalizar, puntosDeMapa } from '../lib/map';
import type { Evento } from '../lib/types';
import type { Lugar } from '../lib/venues';
const HOY = '2026-09-18';
const lugar = (over: Partial<Lugar> = {}): Lugar => ({
  slug: 'bar-prueba',
  nombre: 'Bar de Prueba',
  ciudad: 'Valparaíso',
  zona: 'Cerro Alegre',
  direccion: 'Calle 1',
  tipo: 'bar',
  tipo_label: 'Bar',
  tags: [],
  descripcion: null,
  sitio_url: null,
  instagram_url: null,
  facebook_url: null,
  tiktok_url: null,
  contacto_url: null,
  agenda_url: null,
  estado: 'active',
  imagen_url: null,
  fuente_tipo: 'fuente-publica',
  fuente_url: null,
  ultima_revision: null,
  lat: -33.04,
  lng: -71.62,
  precision_mapa: 'exacta',
  ...over,
});
const evento = (over: Partial<Evento> = {}): Evento =>
  ({
    id: '1',
    nombre: 'Noche de cumbia',
    fecha: HOY,
    hora: '23:00',
    lugar: 'Bar de Prueba',
    ciudad: 'Valparaíso',
    precio: 0,
    categoria: 'otro',
    fuente: 'editorial',
    verificado: false,
    activo: true,
    tipo: 'main',
    ...over,
  }) as Evento;

test('un lugar sin coordenada fiable no llega al mapa', () => {
  assert.equal(puntosDeMapa([lugar({ lat: null, lng: null, precision_mapa: null })], [], HOY).length, 0);
  // Coordenada presente pero precisión no declarada: tampoco.
  assert.equal(puntosDeMapa([lugar({ precision_mapa: null })], [], HOY).length, 0);
  assert.equal(puntosDeMapa([lugar()], [], HOY).length, 1);
});

test('el estado del punto refleja lo que pasa esta noche', () => {
  assert.equal(puntosDeMapa([lugar()], [], HOY)[0].estado, 'lugar');
  assert.equal(puntosDeMapa([lugar()], [evento()], HOY)[0].estado, 'evento');
  assert.equal(puntosDeMapa([lugar()], [evento({ tipo: 'fonda' })], HOY)[0].estado, 'fonda');
  // Un reporte fresco manda sobre todo lo demás.
  assert.equal(puntosDeMapa([lugar()], [evento()], HOY, { 'bar-prueba': '🔥 Prendido' })[0].estado, 'vivo');
});

test('los eventos de mañana no se muestran como los de hoy', () => {
  const punto = puntosDeMapa([lugar()], [evento({ fecha: '2026-09-19' })], HOY)[0];
  assert.equal(punto.estaNoche.length, 0);
  assert.equal(punto.proximos, 1);
  assert.equal(punto.estado, 'lugar');
});

test('el evento se asocia al lugar aunque el nombre venga con acentos distintos', () => {
  const punto = puntosDeMapa([lugar({ nombre: 'Bar Vienés' })], [evento({ lugar: 'BAR VIENES' })], HOY)[0];
  assert.equal(punto.estaNoche.length, 1);
  assert.equal(normalizar('Bar Vienés'), 'bar vienes');
});

test('el encuadre contiene todos los puntos', () => {
  const puntos = puntosDeMapa(
    [lugar({ slug: 'a', lat: -33.04, lng: -71.62 }), lugar({ slug: 'b', nombre: 'Otro', lat: -32.88, lng: -71.24 })],
    [],
    HOY,
  );
  const centro = encuadre(puntos);
  assert.ok(centro.lat < -32.88 && centro.lat > -33.04);
  assert.ok(centro.lng < -71.24 && centro.lng > -71.62);
  assert.equal(encuadre([]).zoom, 12, 'sin puntos, la región completa');
});
