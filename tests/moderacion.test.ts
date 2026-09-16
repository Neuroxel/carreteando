import assert from 'node:assert/strict';
import test from 'node:test';
import { ReviewInputError, reviewInput } from '../lib/review-input';
/** Un FormData mínimo con la misma superficie que usa reviewInput. */
function formulario(campos: Record<string, string>) {
  const mapa = new Map(Object.entries(campos));
  return {
    get: (k: string) => mapa.get(k) ?? null,
    entries: () => mapa.entries(),
  } as unknown as FormData;
}
// La fila tal como la escribe un adaptador: fecha, lugar y fuente correctos,
// y sin organizador, porque la agenda propia de un local no tiene "organizador".
const FILA_ADAPTADOR = {
  nombre: 'Orquesta Cinzano · viernes 18',
  fecha: '2026-09-18',
  hora: '',
  lugar: 'Bar Cinzano',
  ciudad: 'Valparaíso',
  direccion: '',
  precio: '',
  precio_texto: '',
  organizador: '',
  fuente_url: 'https://cinzanooficial.cl/cinzano_event/orquesta-cinzano-2026-09-18/',
  imagen_url: '',
  categoria: 'cumbia',
  descripcion: 'La Orquesta Cinzano enciende el Gran Salón con música en vivo y baile.',
  checked: 'yes',
  note: 'Revisado contra el sitio oficial del local.',
};

test('aprobar una fila de adaptador sin organizador funciona', () => {
  // Era imposible: el validador de aportes públicos exigía organizador de 2+
  // caracteres, y la agenda de un local no trae ese dato. Ninguna aprobación
  // podía completarse y el mensaje de error ni siquiera nombraba el campo.
  const { fields, note } = reviewInput('event', 'approve', 0, formulario(FILA_ADAPTADOR));
  assert.equal(fields.title, 'Orquesta Cinzano · viernes 18');
  assert.equal(fields.venue, 'Bar Cinzano');
  assert.equal(fields.city, 'Valparaíso');
  assert.equal(fields.date_text, '2026-09-18');
  assert.equal(fields.username, null, 'sin organizador es un dato ausente, no un error');
  assert.ok(note.length >= 10);
});

test('aprobar sin descripción tampoco es un error de moderación', () => {
  const { fields } = reviewInput('event', 'approve', 0, formulario({ ...FILA_ADAPTADOR, descripcion: '' }));
  assert.equal(fields.description, '');
});

test('lo que sí debe seguir bloqueando una aprobación', () => {
  const falla = (cambios: Record<string, string>, motivo: string) => {
    try {
      reviewInput('event', 'approve', 0, formulario({ ...FILA_ADAPTADOR, ...cambios }));
      assert.fail(`aceptó ${motivo}`);
    } catch (error) {
      assert.ok(error instanceof ReviewInputError, `${motivo}: error inesperado`);
      assert.equal((error as ReviewInputError).status, 'invalid-fields');
    }
  };
  falla({ ciudad: '' }, 'sin comuna');
  falla({ ciudad: 'Santiago' }, 'una comuna fuera de la región');
  falla({ lugar: '' }, 'sin recinto');
  falla({ fuente_url: '' }, 'sin fuente');
  falla({ fuente_url: 'javascript:alert(1)' }, 'una fuente que no es http');
  falla({ fecha: '2026-09-01' }, 'una fecha pasada');
  falla({ categoria: 'inventada' }, 'un estilo inexistente');
  falla({ nombre: 'ab' }, 'un título de dos letras');
});

test('la casilla de revisión y la nota siguen siendo obligatorias', () => {
  assert.throws(
    () => reviewInput('event', 'approve', 0, formulario({ ...FILA_ADAPTADOR, checked: '' })),
    (e: ReviewInputError) => e.status === 'invalid-check',
  );
  assert.throws(
    () => reviewInput('event', 'approve', 0, formulario({ ...FILA_ADAPTADOR, note: 'corto' })),
    (e: ReviewInputError) => e.status === 'invalid-note',
  );
});

test('retirar y rechazar sólo necesitan la nota', () => {
  for (const accion of ['withdraw', 'reject']) {
    const r = reviewInput('event', accion, 3, formulario({ note: 'Retirado tras confirmar con el local.' }));
    assert.deepEqual(r.fields, {}, `${accion} no debería exigir campos`);
  }
});

test('un error de campo dice qué campo es', () => {
  try {
    reviewInput('event', 'approve', 0, formulario({ ...FILA_ADAPTADOR, ciudad: '' }));
    assert.fail('aceptó comuna vacía');
  } catch (error) {
    const detalle = (error as ReviewInputError).detail;
    assert.ok(detalle && detalle.length > 5, 'el fallo no explica qué revisar');
  }
});

test('el aporte del público conserva sus reglas estrictas', async () => {
  const { validateSubmission, ValidationError } = await import('../lib/submission-validation');
  const aporte = {
    nombre: 'Fiesta de prueba',
    fecha: '2026-09-20',
    hora: '23:00',
    lugar: 'Un bar',
    ciudad: 'Valparaíso',
    direccion: '',
    precio: null,
    precio_texto: '',
    organizador: 'colectivoxyz',
    fuente_url: 'https://example.org/evento',
    imagen_url: '',
    categoria: 'cumbia',
    descripcion: 'Una descripción suficientemente larga para pasar el mínimo.',
    website: '',
  };
  const now = new Date('2026-09-15T12:00:00Z');
  assert.equal(validateSubmission(aporte, now).organizador, 'colectivoxyz');
  // Relajar la moderación no debe relajar lo que llega de fuera.
  assert.throws(
    () => validateSubmission({ ...aporte, organizador: '' }, now),
    ValidationError,
    'el público pudo aportar sin decir quién organiza',
  );
  assert.throws(
    () => validateSubmission({ ...aporte, descripcion: 'corta' }, now),
    ValidationError,
    'el público pudo aportar sin contar de qué se trata',
  );
});
