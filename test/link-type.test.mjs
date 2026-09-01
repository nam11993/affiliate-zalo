import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyShopeeUrl } from '../src/shopee/link-type.mjs';

test('classifies product, video, live and unresolved short links', () => {
  assert.equal(classifyShopeeUrl('https://shopee.vn/product/731999859/41261407193'), 'PRODUCT');
  assert.equal(classifyShopeeUrl('https://sv.shopee.vn/share-video/abc?smtt=0.0.9'), 'VIDEO');
  assert.equal(classifyShopeeUrl('https://live.shopee.vn/share?from=live&viewer=1'), 'LIVE');
  assert.equal(classifyShopeeUrl('https://vn.shp.ee/58nvmrdm?smtt=0.0.9'), 'SHORT');
});
