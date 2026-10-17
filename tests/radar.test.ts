import { test } from 'node:test';
import assert from 'node:assert/strict';
import { distanciaKm, leerCapa, porCercania, textoDistancia } from '../lib/radar';

test('la política del servidor permite GPS al propio sitio y mantiene cámara y micrófono bloqueados', async () => {
  const { default: config } = await import('../next.config.mjs');
  assert.ok(config.headers);
  const rules = await config.headers();
  const policy = rules.flatMap((r: { headers: { key: string; value: string }[] }) => r.headers)
    .find((h: { key: string }) => h.key === 'Permissions-Policy');
  assert.equal(policy?.value, 'camera=(), microphone=(), geolocation=(self)');
});

const plazaSotomayor = { lat: -33.0389, lng: -71.6283 };
const plazaVergara = { lat: -33.0245, lng: -71.5518 };

test('distancia en línea recta entre Valparaíso y Viña', () => {
  const km = distanciaKm(plazaSotomayor, plazaVergara);
  assert.ok(km > 7 && km < 7.5, String(km));
  assert.equal(distanciaKm(plazaSotomayor, plazaSotomayor), 0);
});

test('texto de distancia legible', () => {
  assert.equal(textoDistancia(0.012), '50 m');
  assert.equal(textoDistancia(0.34), '350 m');
  assert.equal(textoDistancia(4.24), '4,2 km');
  assert.equal(textoDistancia(23.6), '24 km');
});

test('ordena por cercanía sin tocar la lista original', () => {
  const lista = [
    { id: 'vina', ...plazaVergara },
    { id: 'valpo', ...plazaSotomayor },
  ];
  const orden = porCercania(lista, { lat: -33.04, lng: -71.63 });
  assert.deepEqual(orden.map((x) => x.punto.id), ['valpo', 'vina']);
  assert.equal(lista[0].id, 'vina');
});

test('el radar abre en carretes de hoy', () => {
  assert.equal(leerCapa(null), 'hoy');
  assert.equal(leerCapa('otra'), 'hoy');
  assert.equal(leerCapa('boliches'), 'boliches');
});

import { esDeDia, nocheAntes } from '../lib/events';
test('en un mismo día, lo nocturno encabeza y lo de día va después', () => {
  const lista = [
    { id: 'almuerzo', fecha: '2026-10-17', hora: '13:00' },
    { id: 'tocata', fecha: '2026-10-17', hora: '21:00' },
    { id: 'sin-hora', fecha: '2026-10-17', hora: null },
    { id: 'manana', fecha: '2026-10-18', hora: '15:00' },
  ];
  assert.deepEqual(nocheAntes(lista).map((e) => e.id), ['tocata', 'sin-hora', 'almuerzo', 'manana']);
  assert.equal(esDeDia('01:30'), false);
  assert.equal(esDeDia('17:59'), true);
});
