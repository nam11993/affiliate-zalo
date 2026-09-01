import test from 'node:test';
import assert from 'node:assert/strict';
import { makeTracking } from '../src/shopee/tracking.mjs';

test('creates stable shaped tracking sub ids', () => {
  const t = makeTracking({ userId: 'user-123', clickId: 'abc123', source: 'zalo', custom: 'p1' });
  assert.deepEqual(t.subIds, ['user123', 'abc123', 'zalo', 'p1']);
  assert.equal(t.subId, 'user123-abc123-zalo-p1');
});
