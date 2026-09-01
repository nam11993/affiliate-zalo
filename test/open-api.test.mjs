import test from 'node:test';
import assert from 'node:assert/strict';
import { ShopeeAffiliateOpenApi } from '../src/shopee/open-api.mjs';

test('generateShortLink parses mocked GraphQL response', async () => {
  const fakeFetch = async (_url, opts) => {
    assert.match(opts.headers.authorization, /^SHA256 Credential=app, Timestamp=\d+, Signature=[a-f0-9]{64}$/);
    return new Response(JSON.stringify({ data: { generateShortLink: { shortLink: 'https://s.shopee.vn/TEST123' } } }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  };
  const api = new ShopeeAffiliateOpenApi({ appId: 'app', secret: 'secret', fetchImpl: fakeFetch });
  assert.equal(await api.generateShortLink('https://shopee.vn/product/1/2', ['u1']), 'https://s.shopee.vn/TEST123');
});
