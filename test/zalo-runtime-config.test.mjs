import test from 'node:test';
import assert from 'node:assert/strict';
import { readZaloRuntimeConfig } from '../src/zalo/personal-adapter.mjs';

test('Zalo config supports reply + auto lock + auto QR open', () => {
  const config = readZaloRuntimeConfig({
    ZALO_REPLY_ENABLED: 'true',
    ZALO_AUTO_LOCK_FIRST_GROUP: 'true',
    ZALO_OPEN_QR_AUTOMATICALLY: 'true',
    ZALO_ALLOWED_GROUP_IDS: ''
  });
  assert.equal(config.replyEnabled, true);
  assert.equal(config.autoLockFirstGroup, true);
  assert.equal(config.openQrAutomatically, true);
  assert.deepEqual(config.allowedGroupIds, []);
});

test('Zalo config parses group allowlist', () => {
  const config = readZaloRuntimeConfig({
    ZALO_ALLOWED_GROUP_IDS: 'g1, g2'
  });
  assert.deepEqual(config.allowedGroupIds, ['g1', 'g2']);
});
