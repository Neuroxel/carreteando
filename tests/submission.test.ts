import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateSubmission,
  submissionIdentity,
  validateReport,
} from '../lib/submission-validation';
import { safeWebUrl, safeImageUrl } from '../lib/safety';
const now = new Date('2026-09-13T02:00:00Z');
const valid = {
  nombre: 'Fiesta del puerto',
  descripcion: 'Noche de techno con entrada y horario por confirmar.',
  fecha: '2026-09-12',
  hora: '23:00',
  lugar: 'Club de prueba',
  ciudad: 'Valparaíso',
  categoria: 'electronica',
  precio: '',
  organizador: 'Productora',
  fuente_url: 'https://www.instagram.com/p/example/',
};
test('submissions accept local today with unknown price, ignore client_id', () => {
  const p = validateSubmission({ ...valid, client_id: 'overwrite' }, now);
  assert.equal(p.precio, null);
  assert.equal('client_id' in p, false);
});
test('reject malformed, oversized, past, out of region, unsafe URLs and spam', () => {
  for (const patch of [
    { fecha: '2026-09-11' },
    { fecha: '2026-02-31' },
    { fecha: '2028-01-01' },
    { hora: '29:00' },
    { ciudad: 'Santiago' },
    { categoria: 'hotel' },
    { precio: -1 },
    { precio: NaN },
    { nombre: 'x'.repeat(161) },
    { nombre: {} },
    { fuente_url: 'javascript:alert(1)' },
    { fuente_url: 'https://user:pass@example.com' },
    { website: 'bot' },
    { descripcion: 'corta' },
  ])
    assert.throws(() => validateSubmission({ ...valid, ...patch }, now), JSON.stringify(patch));
  for (const body of [null, [], 42, 'text']) assert.throws(() => validateSubmission(body, now));
});
test('identity normalizes case and accent', () =>
  assert.equal(
    submissionIdentity(validateSubmission(valid, now)),
    submissionIdentity(
      validateSubmission({ ...valid, nombre: 'FIESTA DEL PUERTO', lugar: 'Clúb de prueba' }, now),
    ),
  ));
test('reports require event id and a useful correction', () => {
  assert.equal(
    validateReport({ evento: 'abc_123', motivo: 'fecha', detalle: 'La fecha fue modificada.' })
      .motivo,
    'fecha',
  );
  assert.throws(() =>
    validateReport({ evento: '../secret', motivo: 'fecha', detalle: 'abcdefghijk' }),
  );
});
test('images and links have separate boundaries', () => {
  assert.equal(safeWebUrl('javascript:alert(1)'), null);
  assert.equal(safeImageUrl('https://127.0.0.1/internal'), null);
  assert.equal(safeImageUrl('https://evil-cdninstagram.com/p.jpg'), null);
  assert.ok(safeImageUrl('https://scontent.cdninstagram.com/p.jpg'));
});
