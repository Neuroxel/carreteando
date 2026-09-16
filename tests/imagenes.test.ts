import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { IMAGE_HOSTS, IMAGE_HOST_SUFFIXES, hostPermitido } from '../lib/image-hosts';
import { safeImageUrl } from '../lib/safety';

test('la lista de dominios y la configuración de imágenes no pueden derivar', () => {
  // Cuando derivaron, next permitía el dominio pero safeImageUrl lo descartaba
  // en silencio: los carteles oficiales de los locales nunca llegaban a la página.
  const config = fs.readFileSync(new URL('../next.config.mjs', import.meta.url), 'utf8');
  const enConfig = [...config.matchAll(/hostname:\s*'([^']+)'/g)].map((m) => m[1]);
  for (const host of IMAGE_HOSTS)
    assert.ok(enConfig.includes(host), `${host} falta en next.config.mjs`);
  for (const sufijo of IMAGE_HOST_SUFFIXES)
    assert.ok(enConfig.includes(`**.${sufijo}`), `**.${sufijo} falta en next.config.mjs`);
  for (const host of enConfig) {
    const limpio = host.replace(/^\*\*\./, '');
    assert.ok(
      IMAGE_HOSTS.includes(host) || IMAGE_HOST_SUFFIXES.includes(limpio),
      `${host} está en next.config.mjs pero no en la lista de dominios`,
    );
  }
});

test('sólo se muestran imágenes de dominios declarados y por https', () => {
  assert.equal(
    safeImageUrl('https://cinzanooficial.cl/wp-content/uploads/2026/07/cartel.jpg'),
    'https://cinzanooficial.cl/wp-content/uploads/2026/07/cartel.jpg',
  );
  assert.equal(safeImageUrl('https://parquecultural.cl/wp-content/uploads/a.jpg')?.length! > 0, true);
  assert.equal(safeImageUrl('https://sitio-cualquiera.cl/foto.jpg'), null);
  assert.equal(safeImageUrl('http://images.portaldisc.com/eventos/1.jpg'), null, 'http no');
  assert.equal(safeImageUrl('javascript:alert(1)'), null);
  assert.equal(safeImageUrl(null), null);
  assert.equal(hostPermitido('scontent.cdninstagram.com'), true);
  assert.equal(hostPermitido('cdninstagram.com.malicioso.cl'), false);
});

test('el import editorial nunca manda una imagen sin origen', async () => {
  // La restricción de la base rechazaba el import completo y tumbaba la ingesta
  // diaria entera con DB_EDITORIAL. Una fila sin origen no debe existir.
  const { editorialRows } = await import('../lib/editorial-feed');
  for (const fila of editorialRows()) {
    const r = fila as Record<string, unknown>;
    if (r.image_url)
      assert.ok(
        r.image_source_url && r.image_kind,
        `${r.instagram_id} lleva imagen sin declarar de dónde salió`,
      );
  }
});
