import test from 'node:test';
import assert from 'node:assert/strict';
import { MessageRouter } from '../src/messaging/router.mjs';

test('router builds quote + mention + fixed affiliate template from mock data', async () => {
  const router = new MessageRouter();
  const result = await router.route({ senderId: 'user-1', senderName: 'Thanh Thanh', groupId: 'group-1', messageId: 'msg-1', text: 'https://shopee.vn/product/731999859/41261407193' }, {
    mockAffiliate: { affiliateUrl: 'https://s.shopee.vn/TEST123', productName: 'Sản phẩm test', commission: 12350 }
  });
  assert.equal(result.action, 'REPLY');
  assert.equal(result.handler, 'affiliate-link');
  assert.equal(result.reply.quoteMessageId, 'msg-1');
  assert.deepEqual(result.reply.mentions, [{ userId: 'user-1', displayName: 'Thanh Thanh' }]);
  assert.match(result.reply.text, /@Thanh Thanh/);
  assert.match(result.reply.text, /https:\/\/s\.shopee\.vn\/TEST123/);
  assert.match(result.reply.text, /Hoa hồng ước tính: 12\.350đ/);
});

test('router ignores own message to prevent reply loops', async () => {
  const router = new MessageRouter();
  const result = await router.route({ senderId: 'bot', groupId: 'group-1', messageId: 'msg-own', text: '#vitien', isOwnMessage: true });
  assert.equal(result.action, 'NO_REPLY');
  assert.equal(result.reason, 'OWN_MESSAGE');
});

test('router recognizes commands but does not activate phase-2 handler by default', async () => {
  const router = new MessageRouter();
  const result = await router.route({ senderId: 'user-1', senderName: 'Trang', groupId: 'group-1', messageId: 'msg-cmd', text: '#vitien' });
  assert.equal(result.parsed.type, 'COMMAND');
  assert.equal(result.parsed.command, 'vitien');
  assert.equal(result.action, 'NO_REPLY');
  assert.equal(result.reason, 'COMMAND_RECOGNIZED_NOT_ENABLED_IN_PHASE_1');
});

test('router ignores normal chat', async () => {
  const router = new MessageRouter();
  const result = await router.route({ senderId: 'user-1', groupId: 'group-1', messageId: 'msg-normal', text: 'xin chào mọi người' });
  assert.equal(result.action, 'NO_REPLY');
  assert.equal(result.reason, 'NO_MATCHING_INTENT');
});

test('router rejects Shopee Video after a short link is resolved', async () => {
  const router = new MessageRouter();
  const result = await router.route({ senderId: 'user-1', senderName: 'Nguyễn Hải Nam', groupId: 'group-1', messageId: 'msg-video', text: 'https://vn.shp.ee/58nvmrdm?smtt=0.0.9' }, {
    mockAffiliate: { resolvedUrl: 'https://sv.shopee.vn/share-video/demo?smtt=0.0.9', affiliateUrl: 'https://s.shopee.vn/SHOULD_NOT_USE', productName: 'x', commission: 1 }
  });
  assert.equal(result.action, 'REPLY');
  assert.equal(result.handler, 'unsupported-media-link');
  assert.equal(result.data.linkType, 'VIDEO');
  assert.match(result.reply.text, /Link Video\/Live Shopee không đổi được affiliate/);
  assert.doesNotMatch(result.reply.text, /SHOULD_NOT_USE/);
});

test('router rejects direct Shopee Live URLs', async () => {
  const router = new MessageRouter();
  const result = await router.route({ senderId: 'user-1', senderName: 'Nam', groupId: 'group-1', messageId: 'msg-live', text: 'https://live.shopee.vn/share?from=live&viewer=1' }, { mockAffiliate: { affiliateUrl: 'https://s.shopee.vn/NO', productName: 'x', commission: 1 } });
  assert.equal(result.handler, 'unsupported-media-link');
  assert.equal(result.data.linkType, 'LIVE');
  assert.match(result.reply.text, /Link Video\/Live Shopee không đổi được affiliate/);
});

test('router does not treat unresolved short link as a product in mock mode', async () => {
  const router = new MessageRouter();
  const result = await router.route({ senderId: 'user-1', senderName: 'Nam', groupId: 'group-1', messageId: 'msg-short', text: 'https://vn.shp.ee/58nvmrdm?smtt=0.0.9' }, {
    mockAffiliate: { affiliateUrl: 'https://s.shopee.vn/SHOULD_NOT_USE', productName: 'x', commission: 1 }
  });
  assert.equal(result.action, 'NO_REPLY');
  assert.equal(result.reason, 'SHORT_LINK_NEEDS_RESOLVE');
});

test('router rejects mock resolved URL when it is still a short link', async () => {
  const router = new MessageRouter();
  const result = await router.route({ senderId: 'user-1', senderName: 'Nam', groupId: 'group-1', messageId: 'msg-short2', text: 'https://vn.shp.ee/58nvmrdm?smtt=0.0.9' }, {
    mockAffiliate: { resolvedUrl: 'https://vn.shp.ee/58nvmrdm?smtt=0.0.9', affiliateUrl: 'https://s.shopee.vn/SHOULD_NOT_USE', productName: 'x', commission: 1 }
  });
  assert.equal(result.action, 'NO_REPLY');
  assert.equal(result.reason, 'SHORT_LINK_STILL_NEEDS_RESOLVE');
});
