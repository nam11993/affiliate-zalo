import { buildCommandPreviewReply } from '../templates/command.template.mjs';

export async function handleCommand({ message, parsed, previewCommands = false }) {
  if (!previewCommands) {
    return {
      action: 'NO_REPLY',
      handler: `command:${parsed.command}`,
      reason: 'COMMAND_RECOGNIZED_NOT_ENABLED_IN_PHASE_1',
      data: { command: parsed.command, args: parsed.args }
    };
  }

  return {
    action: 'REPLY',
    handler: `command:${parsed.command}`,
    reply: {
      text: buildCommandPreviewReply({ displayName: message.senderName, command: parsed.command }),
      quoteMessageId: message.messageId || null,
      mentions: message.senderId ? [{ userId: message.senderId, displayName: message.senderName || '' }] : []
    },
    data: { command: parsed.command, args: parsed.args, mode: 'preview' }
  };
}
