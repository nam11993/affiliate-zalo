import { classifyShopeeUrl } from './link-type.mjs';
import { resolveShopeeUrl } from './url.mjs';

/**
 * Classify any Shopee URL. Short links are always resolved first so we never
 * guess that vn.shp.ee / s.shopee.vn means PRODUCT.
 */
export async function resolveAndClassifyShopeeUrl(input, {
  timeoutMs = 10000,
  maxRedirects = 8,
  fetchImpl = fetch
} = {}) {
  const directType = classifyShopeeUrl(input);

  if (directType !== 'SHORT') {
    return {
      originalUrl: input,
      resolvedUrl: input,
      directType,
      linkType: directType,
      wasShort: false
    };
  }

  const resolvedUrl = await resolveShopeeUrl(input, { timeoutMs, maxRedirects, fetchImpl });
  const linkType = classifyShopeeUrl(resolvedUrl);

  return {
    originalUrl: input,
    resolvedUrl,
    directType,
    linkType,
    wasShort: true
  };
}
