export function normalizeIncomingMessage(input = {}) {
  const text = String(input.text ?? input.message ?? input.content ?? '').trim();
  return {
    senderId: String(input.senderId ?? input.userId ?? ''),
    senderName: String(input.senderName ?? input.displayName ?? '').trim(),
    groupId: String(input.groupId ?? input.threadId ?? ''),
    messageId: String(input.messageId ?? input.msgId ?? ''),
    text,
    isOwnMessage: Boolean(input.isOwnMessage ?? input.fromSelf ?? false),
    receivedAt: input.receivedAt ?? new Date().toISOString(),
    raw: input.raw ?? null
  };
}
