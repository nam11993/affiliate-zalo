import { isAllowedShopeeHost } from '../shopee/url.mjs';

const EXACT_COMMANDS = new Set(['ping', 'vitien', 'donhang', 'ruttien', 'id']);
const ARG_COMMANDS = new Set(['bank']);

function cleanUrlCandidate(value) {
  return value.replace(/[),.;!?\]}>'\"]+$/g, '');
}

export function extractUrls(text) {
  const matches = String(text || '').match(/https?:\/\/[^\s<]+/gi) || [];
  return matches.map(cleanUrlCandidate);
}

export function extractShopeeUrls(text) {
  const unique = new Set();
  for (const candidate of extractUrls(text)) {
    try {
      const url = new URL(candidate);
      if (isAllowedShopeeHost(url.hostname)) unique.add(url.toString());
    } catch {
      // Ignore malformed URLs and continue parsing the rest of the message.
    }
  }
  return [...unique];
}

export function parseMessage(text) {
  const value = String(text || '').trim();
  if (!value) return { type: 'EMPTY' };

  const commandMatch = value.match(/^#([a-zA-Z0-9_]+)(?:\s+([\s\S]*))?$/);
  if (commandMatch) {
    const command = commandMatch[1].toLowerCase();
    const args = (commandMatch[2] || '').trim();

    if (EXACT_COMMANDS.has(command)) {
      return args
        ? { type: 'UNKNOWN_COMMAND', command, args, reason: 'COMMAND_DOES_NOT_ACCEPT_ARGS' }
        : { type: 'COMMAND', command, args: '' };
    }

    if (ARG_COMMANDS.has(command)) {
      return { type: 'COMMAND', command, args };
    }

    return { type: 'UNKNOWN_COMMAND', command, args };
  }

  const shopeeUrls = extractShopeeUrls(value);
  if (shopeeUrls.length) {
    return {
      type: 'SHOPEE_URL',
      urls: shopeeUrls,
      count: shopeeUrls.length
    };
  }

  return { type: 'TEXT', text: value };
}
