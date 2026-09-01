import {
  buildAffiliatePendingReply,
  buildAffiliateReply,
  buildUnsupportedMediaReply,
  buildUnsupportedShopeeLinkReply
} from '../templates/affiliate.template.mjs';
import { classifyShopeeUrl } from '../shopee/link-type.mjs';

function replyEnvelope(message, text) {
  return {
    text,
    quoteMessageId: message.messageId || null,
    mentions: message.senderId ? [{ userId: message.senderId, displayName: message.senderName || '' }] : []
  };
}

function unsupportedResult({ message, kind, originalUrl, resolvedUrl = null, mode }) {
  const text = kind === 'VIDEO' || kind === 'LIVE'
    ? buildUnsupportedMediaReply({ displayName: message.senderName, kind })
    : buildUnsupportedShopeeLinkReply({ displayName: message.senderName });

  return {
    action: 'REPLY',
    handler: kind === 'VIDEO' || kind === 'LIVE' ? 'unsupported-media-link' : 'unsupported-shopee-link',
    reply: replyEnvelope(message, text),
    data: { originalUrl, resolvedUrl, linkType: kind, mode }
  };
}

export async function handleAffiliateLink({
  message,
  parsed,
  mockAffiliate = null,
  processLink = null,
  classifyLink = null
}) {
  const url = parsed.urls[0];
  const directType = classifyShopeeUrl(url);

  // IMPORTANT: short links must be resolved before classification. Never assume SHORT = PRODUCT.
  let classified = null;
  if (classifyLink) {
    try {
      classified = await classifyLink(url);
    } catch (error) {
      return {
        action: 'NO_REPLY',
        handler: 'affiliate-link',
        reason: 'SHORT_LINK_RESOLVE_FAILED',
        data: {
          originalUrl: url,
          linkType: directType,
          error: error instanceof Error ? error.message : String(error)
        }
      };
    }
  } else if (mockAffiliate?.resolvedUrl) {
    classified = {
      originalUrl: url,
      resolvedUrl: mockAffiliate.resolvedUrl,
      linkType: classifyShopeeUrl(mockAffiliate.resolvedUrl),
      directType,
      wasShort: directType === 'SHORT'
    };
  } else if (directType !== 'SHORT') {
    classified = {
      originalUrl: url,
      resolvedUrl: url,
      linkType: directType,
      directType,
      wasShort: false
    };
  }

  if (!classified) {
    return {
      action: 'NO_REPLY',
      handler: 'affiliate-link',
      reason: 'SHORT_LINK_NEEDS_RESOLVE',
      data: { originalUrl: url, linkType: 'SHORT' }
    };
  }

  const finalType = classified.linkType;
  const resolvedUrl = classified.resolvedUrl || url;

  // A resolver result that is still SHORT is not enough to decide the business action.
  if (finalType === 'SHORT') {
    return {
      action: 'NO_REPLY',
      handler: 'affiliate-link',
      reason: 'SHORT_LINK_STILL_NEEDS_RESOLVE',
      data: { originalUrl: url, resolvedUrl, linkType: 'SHORT' }
    };
  }

  if (finalType === 'VIDEO' || finalType === 'LIVE') {
    return unsupportedResult({
      message,
      kind: finalType,
      originalUrl: url,
      resolvedUrl,
      mode: classified.wasShort ? 'short-resolved' : 'direct-classification'
    });
  }

  if (finalType !== 'PRODUCT') {
    return unsupportedResult({
      message,
      kind: finalType || 'OTHER',
      originalUrl: url,
      resolvedUrl,
      mode: classified.wasShort ? 'short-resolved' : 'direct-non-product'
    });
  }

  // Simulator can use real short-link classification while mocking only the
  // Open API product/commission/affiliate output.
  if (mockAffiliate) {
    return {
      action: 'REPLY',
      handler: 'affiliate-link',
      reply: replyEnvelope(message, buildAffiliateReply({
        displayName: message.senderName,
        affiliateUrl: mockAffiliate.affiliateUrl,
        productName: mockAffiliate.productName,
        commission: mockAffiliate.commission
      })),
      data: {
        originalUrl: url,
        resolvedUrl,
        linkType: 'PRODUCT',
        resolution: classified,
        mode: 'mock-after-real-classification'
      }
    };
  }

  if (processLink) {
    const result = await processLink({
      url,
      userId: message.senderId || 'guest',
      displayName: message.senderName,
      resolve: true
    });

    if (result?.linkType !== 'PRODUCT') {
      return unsupportedResult({
        message,
        kind: result?.linkType || 'OTHER',
        originalUrl: url,
        resolvedUrl: result?.resolvedUrl || resolvedUrl,
        mode: 'process-link-classification'
      });
    }

    if (result?.affiliateUrl) {
      return {
        action: 'REPLY',
        handler: 'affiliate-link',
        reply: replyEnvelope(message, buildAffiliateReply({
          displayName: message.senderName,
          affiliateUrl: result.affiliateUrl,
          productName: result.product?.name,
          commission: result.commission?.estimatedCommission
        })),
        data: result
      };
    }
  }

  return {
    action: 'REPLY',
    handler: 'affiliate-link',
    reply: replyEnvelope(message, buildAffiliatePendingReply({ displayName: message.senderName })),
    data: { originalUrl: url, resolvedUrl, linkType: finalType, mode: 'open-api-pending' }
  };
}
