import crypto from 'node:crypto';

function sanitize(value, fallback) {
  const result = String(value ?? '')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .slice(0, 48);
  return result || fallback;
}

export function makeTracking({ userId = 'guest', source = 'zalo', custom = 'phase1', clickId } = {}) {
  const click = clickId || crypto.randomBytes(5).toString('hex');
  const subIds = [
    sanitize(userId, 'guest'),
    sanitize(click, 'click'),
    sanitize(source, 'zalo'),
    sanitize(custom, 'phase1')
  ];
  return {
    clickId: subIds[1],
    subIds,
    subId: subIds.join('-')
  };
}
