import test from 'node:test';
import assert from 'node:assert/strict';
import { processShopeeLink } from '../src/services/phase1.mjs';

test('phase1 resolves known short-link shape but waits for Open API instead of inventing affiliate link', async () => {
  const fakeFetch = async (url) => {
    const current = String(url);
    if (current === 'https://vn.shp.ee/FzQcBoQr') {
      return new Response(null, {
        status: 302,
        headers: { location: 'https://shopee.vn/product/1531118967/49914053013?utm_source=share' }
      });
    }
    if (current.startsWith('https://shopee.vn/product/1531118967/49914053013')) {
      return new Response('ok', { status: 200 });
    }
    throw new Error(`unexpected URL: ${current}`);
  };

  const cfg = {
    shopeeAffiliateId: '17345830644',
    shopeeApiAppId: '',
    shopeeApiSecret: '',
    shopeeApiUrl: 'https://open-api.affiliate.shopee.vn/graphql',
    shopeeOpenApiEnabled: true,
    resolveTimeoutMs: 1000,
    apiTimeoutMs: 1000,
    userShareRate: 1,
    taxWithholdingRate: 0
  };

  const result = await processShopeeLink({
    url: 'https://vn.shp.ee/FzQcBoQr',
    userId: 'U000123',
    displayName: 'Thanh'
  }, { cfg, fetchImpl: fakeFetch });

  assert.equal(result.canonicalUrl, 'https://shopee.vn/product/1531118967/49914053013');
  assert.equal(result.product.shopId, '1531118967');
  assert.equal(result.product.itemId, '49914053013');
  assert.equal(result.affiliateSource, 'pending_open_api');
  assert.equal(result.affiliateUrl, null);
  assert.match(result.tracking.subId, /^U000123-[a-f0-9]{10}-zalo-p1$/);
  assert.doesNotMatch(result.replyText, /👉 Link mua:/);
});


test('phase1 displays Shopee API commission unchanged without local deductions', async () => {
  const fakeFetch = async (url, options = {}) => {
    const current = String(url);
    if (current === 'https://vn.shp.ee/FzQcBoQr') {
      return new Response(null, {
        status: 302,
        headers: { location: 'https://shopee.vn/product/1531118967/49914053013' }
      });
    }
    if (current.startsWith('https://shopee.vn/product/1531118967/49914053013')) {
      return new Response('ok', { status: 200 });
    }
    if (current === 'https://open-api.affiliate.shopee.vn/graphql') {
      const body = JSON.parse(options.body);
      if (body.query.includes('productOfferV2')) {
        return new Response(JSON.stringify({
          data: {
            productOfferV2: {
              nodes: [{
                itemId: 49914053013,
                shopId: 1531118967,
                productName: 'Sản phẩm test',
                commission: '12350',
                commissionRate: '0.05',
                sellerCommissionRate: '0.03',
                shopeeCommissionRate: '0.02'
              }],
              pageInfo: { page: 1, limit: 10, hasNextPage: false }
            }
          }
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (body.query.includes('generateShortLink')) {
        return new Response(JSON.stringify({
          data: { generateShortLink: { shortLink: 'https://s.shopee.vn/testAff' } }
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
    }
    throw new Error(`unexpected URL: ${current}`);
  };

  const cfg = {
    shopeeAffiliateId: '17345830644',
    shopeeApiAppId: 'app-id',
    shopeeApiSecret: 'secret',
    shopeeApiUrl: 'https://open-api.affiliate.shopee.vn/graphql',
    shopeeOpenApiEnabled: true,
    resolveTimeoutMs: 1000,
    apiTimeoutMs: 1000
  };

  const result = await processShopeeLink({
    url: 'https://vn.shp.ee/FzQcBoQr',
    userId: 'U000123',
    displayName: 'Thanh'
  }, { cfg, fetchImpl: fakeFetch });

  assert.equal(result.commission.estimatedCommission, 12350);
  assert.equal('userEstimatedReward' in result.commission, false);
  assert.match(result.replyText, /Hoa hồng ước tính: 12\.350đ/);
  assert.doesNotMatch(result.replyText, /Bạn nhận dự kiến/);
});
