import assert from 'node:assert/strict';
import test from 'node:test';
import { coincideTexto } from '../lib/busqueda';
import { buscarLugares, dbRowToLugar } from '../lib/venues';
import { validateVenueProposal, ValidationError } from '../lib/submission-validation';

const fila = (over: Record<string, unknown> = {}) => ({
  slug: 'cerveceria-anfiteatro',
  name: 'Cervecería Anfiteatro',
  city: 'Valparaíso',
  zone: 'Barrio Cumming',
  venue_type: 'bar',
  is_active: true,
  moderation_status: 'approved',
  status: 'active',
  aliases: ['Anfiteatro Bar'],
  ...over,
});

test('la búsqueda entiende cómo habla la gente', () => {
  assert.ok(coincideTexto('Cervecería Anfiteatro Barrio Cumming', 'chela'));
  assert.ok(coincideTexto('Noche Electrónica en Máscara', 'techno'));
  assert.ok(coincideTexto('Tocata en vivo', 'tocatas'));
  assert.ok(!coincideTexto('Teatro Municipal', 'chela'));
  const l = dbRowToLugar(fila())!;
  assert.equal(buscarLugares([l], 'chela cumming').length, 1);
  assert.equal(buscarLugares([l], 'anfiteatro bar').length, 1, 'el alias también se busca');
});

test('horario y precio solo aparecen con fuente y fecha', () => {
  const sin = dbRowToLugar(fila({ hours_text: 'Ma-Sá 18:00-02:00', price_tier: 2 }))!;
  assert.equal(sin.horario, null);
  assert.equal(sin.precio, null);
  const con = dbRowToLugar(
    fila({
      hours_text: 'Ma-Sá 18:00-02:00',
      hours_source: 'Directorio Barrio Cumming',
      hours_verified_at: '2026-10-03',
      price_tier: 2,
      price_source: 'Carta publicada',
      price_verified_at: '2026-10-03',
    }),
  )!;
  assert.equal(con.horario?.texto, 'Ma-Sá 18:00-02:00');
  assert.equal(con.precio?.nivel, 2);
  assert.equal(dbRowToLugar(fila({ price_tier: 7, price_source: 'x', price_verified_at: '2026-10-03' }))!.precio, null);
});

test('¿Falta un lugar? pide algo comprobable y una comuna real', () => {
  const ok = validateVenueProposal({
    nombre: 'Bar Terraza Miaw',
    ciudad: 'Valparaíso',
    fuente_url: 'https://www.instagram.com/ejemplo/',
    relacion: 'publico',
  });
  assert.equal(ok.nombre, 'Bar Terraza Miaw');
  assert.equal(ok.ficha, null);
  assert.throws(() => validateVenueProposal({ nombre: 'X bar', ciudad: 'Santiago', fuente_url: 'https://a.cl', relacion: 'publico' }), ValidationError);
  assert.throws(() => validateVenueProposal({ nombre: 'X bar', ciudad: 'Valparaíso', relacion: 'publico' }), ValidationError);
  assert.throws(() => validateVenueProposal({ nombre: 'X bar', ciudad: 'Valparaíso', fuente_url: 'javascript:alert(1)', relacion: 'publico' }), ValidationError);
  assert.throws(() => validateVenueProposal({ nombre: 'X bar', ciudad: 'Valparaíso', fuente_url: 'https://a.cl', relacion: 'publico', website: 'spam' }), ValidationError);
});

test('la escena de un lugar sale de lo que es, no solo de su agenda', async () => {
  const { lugarEnEscena } = await import('../lib/escenas');
  assert.ok(lugarEnEscena({ tipo: 'karaoke', tags: [] }, 'karaoke'));
  assert.ok(lugarEnEscena({ tipo: 'bar', tags: ['rock', 'en-vivo'] }, 'rock'));
  assert.ok(lugarEnEscena({ tipo: 'teatro', tags: [] }, 'escena-cultural'));
  assert.ok(!lugarEnEscena({ tipo: 'bar', tags: ['cerveza'] }, 'electronica'));
});
