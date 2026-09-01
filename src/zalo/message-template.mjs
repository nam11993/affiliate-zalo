import { buildAffiliateReply } from '../templates/affiliate.template.mjs';

export function buildZaloReply({ displayName, affiliateUrl, product, commission }) {
  return buildAffiliateReply({
    displayName,
    affiliateUrl,
    productName: product?.name,
    commission: commission?.estimatedCommission
  });
}
