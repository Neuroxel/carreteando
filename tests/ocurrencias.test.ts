import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runSource } from '../lib/sources/dispatcher';
import { sourceById } from '../lib/sources/registry';
import { duplicadosPorFicha } from '../lib/sources/automation';
import { buildCandidate } from '../lib/sources/normalize';
import { eventKey } from '../lib/event-identity';
import { agruparPorHora, horasCompatibles } from '../lib/occurrence';
import { estadoTemporal, porEstadoTemporal } from '../lib/temporal';
import { baseMemoria } from './helpers/base-memoria';
import type { Fetcher } from '../lib/sources/types';

const HOY = '2026-10-24';
// Cartelera de PortalTickets con la misma obra en dos funciones el mismo día.
const tarjeta = (slug: string, hora: string) =>
  `<div class="album"><a href="/evento/${slug}"><img src="https://images.portaldisc.com/eventos/1.jpg"></a>` +
  `<p>ESTOY BIEN EN TEATRO MAURI SCD, VALPARAÍSO</p><p>Sábado 24 de octubre 2026, ${hora}</p><p>Teatro Mauri SCD, Valparaíso</p></div>`;
const cartelera = `<html>PRÓXIMOS EVENTOS ${tarjeta('estoybien-1700', '17:00')}${tarjeta('estoybien-2000', '20:00')}</html>`;
const fetcher: Fetcher = async (u) => (u.includes('/cartelera/') ? { status: 200, body: cartelera } : { status: 404, body: '' });

test('identidad: dos funciones del mismo día tienen claves distintas; sin hora, la clave de siempre', () => {
  const base = { sourceId: 'portaldisc-teatromauri', title: 'Estoy Bien', date: HOY, city: 'Valparaíso', confidence: 'high' as const, reasons: [] };
  const a = buildCandidate({ ...base, time: '20:00', detailUrl: 'https://www.portaldisc.com/evento/x' });
  const b = buildCandidate({ ...base, time: '22:00', detailUrl: 'https://www.portaldisc.com/evento/x' });
  const sinHora = buildCandidate({ ...base, time: null, detailUrl: 'https://www.portaldisc.com/evento/x' });
  assert.notEqual(a?.key, b?.key);
  assert.equal(sinHora?.key, 'src-portaldisc-teatromauri-2026-10-24-estoy-bien');
  assert.equal(a?.title, 'Estoy Bien', 'la hora no entra al título visible');
  assert.notEqual(eventKey('teatro-mauri-scd', HOY, 'Estoy Bien', '20:00'), eventKey('teatro-mauri-scd', HOY, 'Estoy Bien', '22:00'));
  assert.equal(eventKey('liberty', HOY, 'Tributo'), 'liberty|2026-10-24|tributo');
});

test('horas compatibles: apertura y show son la misma función; 20:00 y 22:00 no', () => {
  assert.equal(horasCompatibles('20:00', '21:00'), true);
  assert.equal(horasCompatibles('20:00', '22:00'), false);
  assert.equal(horasCompatibles(null, '22:00'), true);
  assert.deepEqual(agruparPorHora([{ h: '20:00' }, { h: '22:00' }, { h: '20:30' }], (x) => x.h).map((g) => g.map((x) => x.h)), [['20:00', '20:30'], ['22:00']]);
  // Sin hora y con dos funciones conocidas no se adivina a cuál pertenece.
  assert.equal(agruparPorHora([{ h: '20:00' }, { h: '22:00' }, { h: null }], (x) => x.h).length, 3);
});

test('ingesta: dos funciones reales quedan como dos filas y una recarga no las duplica', async () => {
  const { db, tablas } = baseMemoria({ venues: [{ id: 7, slug: 'teatro-mauri-scd' }] });
  const fuente = sourceById('portaldisc-teatromauri')!;
  const primera = await runSource(fuente, db, fetcher, '2026-10-20');
  assert.equal(primera.ok, true);
  const filas = tablas.events.filter((e) => e.date_text === HOY);
  assert.deepEqual(filas.map((e) => e.event_time).sort(), ['17:00', '20:00']);
  assert.equal(new Set(filas.map((e) => e.instagram_id)).size, 2);
  const segunda = await runSource(fuente, db, fetcher, '2026-10-20');
  assert.equal(tablas.events.filter((e) => e.date_text === HOY).length, 2, 'recargar no duplica');
  assert.equal(segunda.duplicates, 2);
  assert.deepEqual(tablas.events.map((e) => e.event_time).sort(), ['17:00', '20:00'], 'ninguna sobrescribe a la otra');
});

test('ingesta: la misma función vista por otra fuente se une a la existente', async () => {
  const { db, tablas } = baseMemoria({
    events: [
      { id: 1, instagram_id: 'src-portaldisc-region-2026-10-24-2000-estoy-bien', title: 'ESTOY BIEN EN TEATRO MAURI SCD, VALPARAÍSO', venue: 'Teatro Mauri SCD', date_text: HOY, event_time: '20:00', instagram_url: 'https://www.portaldisc.com/evento/otra-url', disposition: 'public' },
    ],
  });
  const soloVeinte = `<html>PRÓXIMOS EVENTOS ${tarjeta('estoybien-2000', '20:00')}</html>`;
  const r = await runSource(sourceById('portaldisc-teatromauri')!, db, async (u) => (u.includes('/cartelera/') ? { status: 200, body: soloVeinte } : { status: 404, body: '' }), '2026-10-20');
  assert.equal(r.duplicates, 1);
  assert.equal(tablas.events.length, 1, 'una sola ocurrencia, con evidencia de las dos fuentes');
});

test('motor: una ficha que vende dos funciones no marca la segunda como copia', () => {
  const url = 'https://www.portaldisc.com/evento/estoybien';
  const sinEvidencia = new Map();
  const dos = duplicadosPorFicha(
    [
      { id: 1, source_detail_url: url, date_text: HOY, event_time: '20:00', disposition: 'public' },
      { id: 2, source_detail_url: url, date_text: HOY, event_time: '22:00', disposition: 'review' },
    ],
    sinEvidencia,
  );
  assert.equal(dos.size, 0);
  const recarga = duplicadosPorFicha(
    [
      { id: 1, source_detail_url: url, date_text: HOY, event_time: '20:00', disposition: 'public' },
      { id: 2, source_detail_url: url, date_text: HOY, event_time: '20:30', disposition: 'review' },
    ],
    sinEvidencia,
  );
  assert.deepEqual([...recarga], [[2, 1]]);
});

test('estado temporal: iniciado no es terminado; solo un final explícito lo termina', () => {
  const ahora = { fecha: '2026-10-17', minutos: 17 * 60 + 10 };
  assert.equal(estadoTemporal({ fecha: '2026-10-17', hora: '23:30' }, ahora), 'proximo');
  assert.equal(estadoTemporal({ fecha: '2026-10-17', hora: '13:00' }, ahora), 'iniciado', 'sin final no se asume terminado');
  assert.equal(estadoTemporal({ fecha: '2026-10-17', hora: '13:00', fin: '16:00' }, ahora), 'finalizado');
  assert.equal(estadoTemporal({ fecha: '2026-10-17', hora: '13:00', fin: '18:00' }, ahora), 'iniciado');
  assert.equal(estadoTemporal({ fecha: '2026-10-16', hora: '23:00', fin: '04:00' }, { fecha: '2026-10-17', minutos: 3 * 60 }), 'iniciado', 'el final cruza la medianoche');
  assert.equal(estadoTemporal({ fecha: '2026-10-17', hora: null }, ahora), 'sin_hora');
  assert.equal(estadoTemporal({ fecha: '2026-10-18', hora: '01:00' }, ahora), 'proximo');
  const orden = porEstadoTemporal(
    [
      { id: 'almuerzo', fecha: '2026-10-17', hora: '13:00' },
      { id: 'cerrado', fecha: '2026-10-17', hora: '12:00', fin: '14:00' },
      { id: 'noche', fecha: '2026-10-17', hora: '23:30' },
      { id: 'sin-hora', fecha: '2026-10-17', hora: null },
    ],
    ahora,
  ).map((e) => e.id);
  assert.deepEqual(orden, ['noche', 'sin-hora', 'almuerzo', 'cerrado']);
});
