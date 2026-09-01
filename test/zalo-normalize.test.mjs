import test from 'node:test';
import assert from 'node:assert/strict';
import { buildZcaMention, isPlainTextZcaMessage, normalizeZcaMessage } from '../src/zalo/zca-normalize.mjs';

test('normalize zca group text message', () => {
  const raw = {
    type: 1,
    threadId: 'group-123',
    isSelf: false,
    data: {
      uidFrom: 'user-456',
      dName: 'Nguyễn Hải Nam',
      msgId: 'msg-789',
      content: ' https://vn.shp.ee/abc '
    }
  };
  const normalized = normalizeZcaMessage(raw);
  assert.equal(normalized.senderId, 'user-456');
  assert.equal(normalized.senderName, 'Nguyễn Hải Nam');
  assert.equal(normalized.groupId, 'group-123');
  assert.equal(normalized.messageId, 'msg-789');
  assert.equal(normalized.text, 'https://vn.shp.ee/abc');
  assert.equal(normalized.isOwnMessage, false);
});

test('plain text detector rejects non-string content', () => {
  assert.equal(isPlainTextZcaMessage({ data: { content: 'hello' } }), true);
  assert.equal(isPlainTextZcaMessage({ data: { content: { title: 'card' } } }), false);
});

test('build mention points to @displayName in rendered text', () => {
  const text = '@Nguyễn Hải Nam đã gửi link sản phẩm Shopee ✅';
  const mentions = buildZcaMention({ text, senderId: '123', senderName: 'Nguyễn Hải Nam' });
  assert.deepEqual(mentions, [{ pos: 0, len: '@Nguyễn Hải Nam'.length, uid: '123' }]);
});
