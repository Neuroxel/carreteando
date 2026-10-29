import { test } from 'node:test';
import assert from 'node:assert/strict';
import { visibleEnCartelera } from '../lib/temporal';

test('fin confirmado y límite provisional para eventos sin fin', () => {
  const fecha = '2026-10-25';
  const a = (minutos: number) => ({ fecha, minutos });
  assert.equal(visibleEnCartelera({ fecha, hora: '11:00' }, a(23 * 60 + 52)), false);
  assert.equal(visibleEnCartelera({ fecha, hora: '11:00' }, a(18 * 60 + 59)), true);
  assert.equal(visibleEnCartelera({ fecha, hora: '11:00' }, a(19 * 60)), false);
  assert.equal(visibleEnCartelera({ fecha, hora: '11:00', fin: '23:59' }, a(23 * 60 + 52)), true);
  assert.equal(visibleEnCartelera({ fecha, hora: '11:00', fin: '12:00' }, a(12 * 60)), false);
  assert.equal(visibleEnCartelera({ fecha, hora: null }, a(23 * 60)), true);
});

test('noche cruza la medianoche y respeta el fin real', () => {
  const e = { fecha: '2026-10-24', hora: '23:00' };
  const a = (minutos: number) => ({ fecha: '2026-10-25', minutos });
  assert.equal(visibleEnCartelera(e, a(2 * 60)), true);
  assert.equal(visibleEnCartelera({ ...e, fin: '03:00' }, a(3 * 60)), false);
  assert.equal(visibleEnCartelera(e, a(7 * 60)), false);
});
