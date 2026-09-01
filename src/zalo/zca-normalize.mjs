function firstNonEmpty(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== '') return String(value);
  }
  return '';
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * zca-js emits normal text as data.content:string, but Zalo link-preview
 * messages (msgType=chat.link) can arrive as data.content:object.
 * In that object the real shared URL is commonly stored in `href`.
 * Keep a small allowlist of URL-ish keys rather than serialising arbitrary
 * attachment metadata into the command parser.
 */
export function extractTextFromZcaContent(content) {
  if (typeof content === 'string') return content.trim();
  if (!content || typeof content !== 'object') return '';

  const url = firstNonEmpty(
    cleanString(content.href),
    cleanString(content.url),
    cleanString(content.link),
    cleanString(content.oriUrl),
    cleanString(content.normalUrl),
    cleanString(content.originalUrl),
    cleanString(content.canonicalUrl)
  );
  if (url) return url.trim();

  // Some Zalo payloads nest link metadata one level down.
  for (const key of ['linkInfo', 'preview', 'attachment', 'data']) {
    const nested = content[key];
    if (nested && typeof nested === 'object') {
      const nestedText = extractTextFromZcaContent(nested);
      if (nestedText) return nestedText;
    }
  }

  // Fallback only for explicit textual fields. Do not use title/description as
  // input when no URL exists because that could accidentally trigger commands.
  return firstNonEmpty(
    cleanString(content.text),
    cleanString(content.message),
    cleanString(content.msg)
  ).trim();
}

/**
 * Convert a zca-js inbound message into the project-neutral message shape.
 * This function is intentionally pure so it can be unit-tested without Zalo.
 */
export function normalizeZcaMessage(message = {}) {
  const data = message?.data ?? {};
  const text = extractTextFromZcaContent(data.content);

  const senderId = firstNonEmpty(data.uidFrom, data.senderId, message.senderId);
  const senderName = firstNonEmpty(data.dName, data.displayName, message.senderName).trim();
  const groupId = firstNonEmpty(message.threadId, data.idTo, data.threadId);
  const messageId = firstNonEmpty(
    data.msgId,
    data.globalMsgId,
    data.cliMsgId,
    message.messageId,
    message.msgId
  );

  return {
    senderId,
    senderName,
    groupId,
    messageId,
    text,
    isOwnMessage: Boolean(message.isSelf),
    raw: message
  };
}

/**
 * Returns true for normal text and link-preview payloads that contain a usable
 * URL/text. The old implementation accepted only strings, causing pasted
 * Shopee links rendered by Zalo as `chat.link` to be ignored.
 */
export function isSupportedZcaMessage(message = {}) {
  return extractTextFromZcaContent(message?.data?.content).length > 0;
}

// Kept as an alias for compatibility with older imports/tests.
export const isPlainTextZcaMessage = isSupportedZcaMessage;

export function buildZcaMention({ text, senderId, senderName }) {
  if (!text || !senderId || !senderName) return [];
  const token = `@${senderName}`;
  const pos = text.indexOf(token);
  if (pos < 0) return [];
  return [{ pos, len: token.length, uid: String(senderId) }];
}
