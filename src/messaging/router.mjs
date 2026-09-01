import { normalizeIncomingMessage } from './normalize.mjs';
import { parseMessage } from './parser.mjs';
import { MessageDeduper } from './dedupe.mjs';
import { handleAffiliateLink } from '../handlers/affiliate-link.handler.mjs';
import { handleCommand } from '../handlers/command.handler.mjs';

export class MessageRouter {
  constructor({ allowedGroupIds = [], deduper = new MessageDeduper(), processLink = null, classifyLink = null } = {}) {
    this.allowedGroupIds = new Set(allowedGroupIds.map(String));
    this.deduper = deduper;
    this.processLink = processLink;
    this.classifyLink = classifyLink;
  }

  async route(input, { mockAffiliate = null, previewCommands = false, skipDedupe = false } = {}) {
    const message = normalizeIncomingMessage(input);

    if (message.isOwnMessage) {
      return { action: 'NO_REPLY', reason: 'OWN_MESSAGE', message, parsed: null };
    }

    if (this.allowedGroupIds.size && !this.allowedGroupIds.has(message.groupId)) {
      return { action: 'NO_REPLY', reason: 'GROUP_NOT_ALLOWED', message, parsed: null };
    }

    if (!skipDedupe && this.deduper.hasOrAdd(message)) {
      return { action: 'NO_REPLY', reason: 'DUPLICATE_MESSAGE', message, parsed: null };
    }

    const parsed = parseMessage(message.text);

    if (parsed.type === 'COMMAND') {
      const result = await handleCommand({ message, parsed, previewCommands });
      return { ...result, message, parsed };
    }

    if (parsed.type === 'SHOPEE_URL') {
      const result = await handleAffiliateLink({
        message,
        parsed,
        mockAffiliate,
        processLink: this.processLink,
        classifyLink: this.classifyLink
      });
      return { ...result, message, parsed };
    }

    return {
      action: 'NO_REPLY',
      reason: parsed.type === 'UNKNOWN_COMMAND' ? 'UNKNOWN_COMMAND' : 'NO_MATCHING_INTENT',
      message,
      parsed
    };
  }
}
