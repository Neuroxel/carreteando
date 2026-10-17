import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { unstable_getResponseFromNextConfig, getRedirectUrl } from 'next/experimental/testing/server';

const config = import(pathToFileURL(resolve('next.config.mjs')).href);

test('el dominio antiguo redirige permanentemente y conserva rutas y filtros', async () => {
  const { default: nextConfig } = await config;
  for (const path of ['/', '/evento/curated-20261018-mad-professor-trota', '/explorar?fecha=hoy&ciudad=Valpara%C3%ADso']) {
    const response = await unstable_getResponseFromNextConfig({ url: `https://carreteando.vercel.app${path}`, nextConfig });
    assert.equal(response.status, 308);
    assert.equal(getRedirectUrl(response), `https://dondesalgo.vercel.app${path}`);
  }
});

test('la canónica y las vistas previas no entran en un bucle de redirecciones', async () => {
  const { default: nextConfig } = await config;
  for (const host of ['dondesalgo.vercel.app', 'carreteando-git-fix-canonical-dondesalgo-neuroxel.vercel.app', 'localhost:3000']) {
    const response = await unstable_getResponseFromNextConfig({ url: `https://${host}/explorar?fecha=hoy`, nextConfig });
    assert.equal(getRedirectUrl(response), null);
  }
});
