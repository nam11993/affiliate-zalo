export class MessageDeduper {
  constructor({ ttlMs = 5 * 60 * 1000, maxEntries = 5000 } = {}) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
    this.seen = new Map();
  }

  _cleanup(now = Date.now()) {
    for (const [key, expiresAt] of this.seen) {
      if (expiresAt <= now) this.seen.delete(key);
    }
    if (this.seen.size <= this.maxEntries) return;
    const extra = this.seen.size - this.maxEntries;
    let removed = 0;
    for (const key of this.seen.keys()) {
      this.seen.delete(key);
      if (++removed >= extra) break;
    }
  }

  hasOrAdd(message) {
    const key = message.messageId
      ? `${message.groupId}:${message.messageId}`
      : `${message.groupId}:${message.senderId}:${message.text}`;
    const now = Date.now();
    this._cleanup(now);
    if (this.seen.has(key)) return true;
    this.seen.set(key, now + this.ttlMs);
    return false;
  }
}
