import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMessage, extractShopeeUrls } from '../src/messaging/parser.mjs';

test('parser recognizes exact commands', () => {
  assert.deepEqual(parseMessage('#vitien'), { type: 'COMMAND', command: 'vitien', args: '' });
  assert.deepEqual(parseMessage('#donhang'), { type: 'COMMAND', command: 'donhang', args: '' });
  assert.deepEqual(parseMessage('#id'), { type: 'COMMAND', command: 'id', args: '' });
});

test('parser recognizes #bank with args', () => {
  assert.deepEqual(parseMessage('#bank 0123456789.VCB.NGUYEN VAN A'), {
    type: 'COMMAND', command: 'bank', args: '0123456789.VCB.NGUYEN VAN A'
  });
});

test('parser extracts Shopee URL even when surrounded by normal text', () => {
  const text = 'mua giúp link này https://shopee.vn/product/731999859/41261407193?d_id=e13c7&utm_content=x nhé';
  const parsed = parseMessage(text);
  assert.equal(parsed.type, 'SHOPEE_URL');
  assert.equal(parsed.count, 1);
  assert.equal(parsed.urls[0], 'https://shopee.vn/product/731999859/41261407193?d_id=e13c7&utm_content=x');
});

test('parser ignores non-Shopee URLs', () => {
  assert.deepEqual(extractShopeeUrls('https://example.com/a'), []);
  assert.equal(parseMessage('hello https://example.com/a').type, 'TEXT');
});
