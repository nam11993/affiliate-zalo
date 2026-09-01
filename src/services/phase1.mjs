import { config as defaultConfig, hasOpenApiCredentials } from '../config.mjs';
import { canonicalizeShopeeUrl, extractProductIdentity } from '../shopee/url.mjs';
import { makeTracking } from '../shopee/tracking.mjs';
import { ShopeeAffiliateOpenApi } from '../shopee/open-api.mjs';
import { buildZaloReply } from '../zalo/message-template.mjs';
import { buildAffiliatePendingReply, buildUnsupportedMediaReply, buildUnsupportedShopeeLinkReply } from '../templates/affiliate.template.mjs';
import { resolveAndClassifyShopeeUrl } from '../shopee/classifier.mjs';
import { classifyShopeeUrl } from '../shopee/link-type.mjs';

function normalizeMoney(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function buildCommission(offer) {
  if (!offer) return null;
  return {
    // Phase 1 business rule: display Shopee's API `commission` value exactly as received.
    // Do not apply tax, revenue-share, payout, or any other local calculation.
    estimatedCommission: normalizeMoney(offer.commission),
    commissionRate: normalizeMoney(offer.commissionRate),
    sellerCommissionRate: normalizeMoney(offer.sellerCommissionRate),
    shopeeCommissionRate: normalizeMoney(offer.shopeeCommissionRate),
    label: 'estimated'
  };
}

export async function processShopeeLink({ url, userId, displayName, resolve = true }, {
  cfg = defaultConfig,
  fetchImpl = fetch
} = {}) {
  if (!url) throw new Error('Thiếu url.');

  const classified = resolve
    ? await resolveAndClassifyShopeeUrl(url, { timeoutMs: cfg.resolveTimeoutMs, fetchImpl })
    : { originalUrl: url, resolvedUrl: url, linkType: classifyShopeeUrl(url), directType: classifyShopeeUrl(url), wasShort: false };
  const resolvedUrl = classified.resolvedUrl;
  const linkType = classified.linkType;

  if (linkType !== 'PRODUCT') {
    const isMedia = linkType === 'VIDEO' || linkType === 'LIVE';
    return {
      originalUrl: url,
      resolvedUrl,
      canonicalUrl: resolvedUrl,
      linkType,
      affiliateUrl: null,
      affiliateSource: isMedia ? 'unsupported_media' : 'unsupported_non_product',
      tracking: null,
      product: null,
      commission: null,
      warnings: [],
      replyText: isMedia
        ? buildUnsupportedMediaReply({ displayName, kind: linkType })
        : buildUnsupportedShopeeLinkReply({ displayName })
    };
  }

  const canonicalUrl = canonicalizeShopeeUrl(resolvedUrl);
  const identity = extractProductIdentity(canonicalUrl);
  const tracking = makeTracking({ userId, source: 'zalo', custom: 'p1' });

  let offer = null;
  let affiliateUrl = null;
  let affiliateSource = null;
  let openApiError = null;

  if (hasOpenApiCredentials(cfg)) {
    const api = new ShopeeAffiliateOpenApi({
      appId: cfg.shopeeApiAppId,
      secret: cfg.shopeeApiSecret,
      endpoint: cfg.shopeeApiUrl,
      timeoutMs: cfg.apiTimeoutMs,
      fetchImpl
    });
    try {
      if (identity) offer = await api.getProductOffer(identity);
      affiliateUrl = await api.generateShortLink(canonicalUrl, tracking.subIds);
      if (affiliateUrl) affiliateSource = 'open_api_generateShortLink';
    } catch (error) {
      openApiError = error instanceof Error ? error.message : String(error);
    }
  }

  if (!affiliateUrl) {
    affiliateSource = 'pending_open_api';
  }

  const commission = buildCommission(offer);
  const product = offer ? {
    shopId: String(offer.shopId ?? identity?.shopId ?? ''),
    itemId: String(offer.itemId ?? identity?.itemId ?? ''),
    name: offer.productName || null,
    shopName: offer.shopName || null,
    imageUrl: offer.imageUrl || null,
    priceMin: normalizeMoney(offer.priceMin),
    priceMax: normalizeMoney(offer.priceMax),
    sales: offer.sales ?? null,
    ratingStar: offer.ratingStar ?? null
  } : identity ? { ...identity } : null;

  const result = {
    originalUrl: url,
    resolvedUrl,
    canonicalUrl,
    linkType,
    affiliateUrl,
    affiliateSource,
    tracking,
    product,
    commission,
    warnings: openApiError ? [`Open API không dùng được, đã fallback: ${openApiError}`] : []
  };

  result.replyText = affiliateUrl
    ? buildZaloReply({ ...result, displayName })
    : buildAffiliatePendingReply({ displayName });
  return result;
}
