export function formatVnd(value) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Number(value)) + 'đ';
}

export function buildAffiliateReply({ displayName, affiliateUrl, productName, commission }) {
  const who = displayName ? `@${displayName}` : 'Bạn';
  const lines = [`${who} ơi mua qua link này được hoa hồng nhé 👇`];
  if (productName) lines.push('', `🛍 ${productName}`);
  if (affiliateUrl) lines.push(`👉 Link mua: ${affiliateUrl}`);
  if (commission != null) lines.push(`🌷 Hoa hồng ước tính: ${formatVnd(commission)}`);
  return lines.join('\n');
}

export function buildAffiliatePendingReply({ displayName }) {
  const who = displayName ? `@${displayName}` : 'Bạn';
  return [`${who} đã gửi link sản phẩm Shopee ✅`, '', '⏳ Phần tạo link Affiliate và lấy hoa hồng đang chờ Shopee cấp quyền Open API.'].join('\n');
}

export function buildUnsupportedMediaReply({ displayName, kind = 'VIDEO_LIVE' }) {
  const who = displayName ? `@${displayName}` : 'Bạn';
  return `${who} Link Video/Live Shopee không đổi được affiliate. Bạn gửi link sản phẩm (trang chi tiết SP) nhé.`;
}

export function buildUnsupportedShopeeLinkReply({ displayName }) {
  const who = displayName ? `@${displayName}` : 'Bạn';
  return `${who} Link này không phải trang chi tiết sản phẩm Shopee. Bạn gửi link sản phẩm (trang chi tiết SP) nhé.`;
}
