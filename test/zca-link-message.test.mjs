import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractTextFromZcaContent,
  isSupportedZcaMessage,
  normalizeZcaMessage
} from '../src/zalo/zca-normalize.mjs';
import { parseMessage } from '../src/messaging/parser.mjs';

test('extracts href from Zalo chat.link content object', () => {
  const content = {
    title: 'Shopee product preview',
    href: 'https://vn.shp.ee/ChGJyKaH',
    thumb: 'https://example.invalid/thumb.jpg'
  };
  assert.equal(extractTextFromZcaContent(content), 'https://vn.shp.ee/ChGJyKaH');
});

test('normalizes Zalo link-preview message and parser detects Shopee URL', () => {
  const inbound = {
    type: 1,
    threadId: '2421285310598208197',
    isSelf: false,
    data: {
      msgType: 'chat.link',
      uidFrom: '4787155277638257712',
      dName: 'Hằng',
      msgId: '8215143972559',
      content: {
        href: 'https://vn.shp.ee/ChGJyKaH',
        title: 'Shopee'
      }
    }
  };

  assert.equal(isSupportedZcaMessage(inbound), true);
  const normalized = normalizeZcaMessage(inbound);
  assert.equal(normalized.text, 'https://vn.shp.ee/ChGJyKaH');
  assert.equal(normalized.senderName, 'Hằng');

  const parsed = parseMessage(normalized.text);
  assert.equal(parsed.type, 'SHOPEE_URL');
  assert.equal(parsed.urls.length, 1);
});

test('supports nested link-preview metadata', () => {
  const inbound = {
    data: {
      content: {
        preview: {
          href: 'https://s.shopee.vn/abc123'
        }
      }
    }
  };
  assert.equal(isSupportedZcaMessage(inbound), true);
  assert.equal(normalizeZcaMessage(inbound).text, 'https://s.shopee.vn/abc123');
});
