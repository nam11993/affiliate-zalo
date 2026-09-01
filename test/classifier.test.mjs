import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAndClassifyShopeeUrl } from '../src/shopee/classifier.mjs';

function redirectFetch(chain) {
  return async (url) => {
    const key = String(url);
    const hit = chain[key];
    if (!hit) throw new Error(`Unexpected URL ${key}`);
    if (hit.location) {
      return new Response('', { status: 302, headers: { location: hit.location } });
    }
    return new Response(hit.body || '', { status: 200 });
  };
}

test('short link is resolved then classified as VIDEO', async () => {
  const original = 'https://vn.shp.ee/58nvmrdm?smtt=0.0.9';
  const final = 'https://sv.shopee.vn/share-video/abc';
  const result = await resolveAndClassifyShopeeUrl(original, {
    fetchImpl: redirectFetch({
      [original]: { location: final },
      [final]: { body: '<html></html>' }
    })
  });
  assert.equal(result.wasShort, true);
  assert.equal(result.resolvedUrl, final);
  assert.equal(result.linkType, 'VIDEO');
});

test('short link is resolved then classified as PRODUCT', async () => {
  const original = 'https://vn.shp.ee/abc123';
  const final = 'https://shopee.vn/product/731999859/41261407193';
  const result = await resolveAndClassifyShopeeUrl(original, {
    fetchImpl: redirectFetch({
      [original]: { location: final },
      [final]: { body: '<html></html>' }
    })
  });
  assert.equal(result.wasShort, true);
  assert.equal(result.linkType, 'PRODUCT');
  assert.equal(result.resolvedUrl, final);
});
