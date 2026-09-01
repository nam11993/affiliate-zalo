import test from 'node:test';
import assert from 'node:assert/strict';
import { extractProductIdentity, canonicalizeShopeeUrl } from '../src/shopee/url.mjs';

test('extracts product identity from /product/shop/item', () => {
  assert.deepEqual(
    extractProductIdentity('https://shopee.vn/product/1531118967/49914053013?utm_source=x'),
    { shopId: '1531118967', itemId: '49914053013' }
  );
});

test('extracts product identity from legacy -i.shop.item URL', () => {
  assert.deepEqual(
    extractProductIdentity('https://shopee.vn/abc-san-pham-i.1531118967.49914053013'),
    { shopId: '1531118967', itemId: '49914053013' }
  );
});

test('canonicalizes product URL', () => {
  assert.equal(
    canonicalizeShopeeUrl('https://shopee.vn/product/1531118967/49914053013?utm_medium=affiliates&utm_source=an_1'),
    'https://shopee.vn/product/1531118967/49914053013'
  );
});

test('resolveShopeeUrl follows an HTML bridge to Shopee Video', async () => {
  const { resolveShopeeUrl } = await import('../src/shopee/url.mjs');
  const start = 'https://vn.shp.ee/video-bridge';
  const final = 'https://sv.shopee.vn/share-video/xyz';
  const fetchImpl = async (url) => {
    if (String(url) === start) {
      return new Response(`<html><script>window.location.href="${final}"</script></html>`, {
        status: 200,
        headers: { 'content-type': 'text/html' }
      });
    }
    if (String(url) === final) {
      return new Response('<html>video</html>', { status: 200, headers: { 'content-type': 'text/html' } });
    }
    throw new Error(`Unexpected URL ${url}`);
  };
  assert.equal(await resolveShopeeUrl(start, { fetchImpl }), final);
});
