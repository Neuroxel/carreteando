import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { unstable_getResponseFromNextConfig, getRedirectUrl } from 'next/experimental/testing/server';

const config = import(pathToFileURL(resolve('next.config.mjs')).href);

test('ambos dominios antiguos redirigen permanentemente conservando rutas y filtros', async () => {
  const { default: nextConfig } = await config;
  for (const host of ['carreteando.vercel.app', 'dondesalgo.vercel.app']) {
    for (const path of ['/', '/evento/curated-20261018-mad-professor-trota', '/explorar?fecha=hoy&ciudad=Valpara%C3%ADso']) {
      const response = await unstable_getResponseFromNextConfig({ url: `https://${host}${path}`, nextConfig });
      assert.equal(response.status, 308);
      assert.equal(getRedirectUrl(response), `https://www.dondesalgo.cl${path}`);
    }
  }
});

test('cron no redirige y la canónica y previews no forman bucles', async () => {
  const { default: nextConfig } = await config;
  for (const host of ['carreteando.vercel.app', 'dondesalgo.vercel.app']) {
    for (const path of ['/api/cron/scrape', '/api/cron/automatizacion?modo=refresh']) {
      const response = await unstable_getResponseFromNextConfig({ url: `https://${host}${path}`, nextConfig });
      assert.equal(getRedirectUrl(response), null);
    }
  }
  for (const host of ['www.dondesalgo.cl', 'carreteando-git-fix-canonical-dondesalgo-neuroxel.vercel.app', 'localhost:3000']) {
    const response = await unstable_getResponseFromNextConfig({ url: `https://${host}/explorar?fecha=hoy`, nextConfig });
    assert.equal(getRedirectUrl(response), null);
  }
});
