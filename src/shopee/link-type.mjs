import { assertShopeeUrl, extractProductIdentity } from './url.mjs';

const SHORT_HOSTS = new Set(['vn.shp.ee', 'shp.ee', 's.shopee.vn', 'shopee.page.link']);

export function classifyShopeeUrl(input) {
  const url = assertShopeeUrl(input);
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const path = decodeURIComponent(url.pathname || '').toLowerCase();

  if (host === 'sv.shopee.vn') return 'VIDEO';
  if (host === 'live.shopee.vn') return 'LIVE';
  if (extractProductIdentity(url.toString())) return 'PRODUCT';
  if (SHORT_HOSTS.has(host)) return 'SHORT';

  // Extra defensive patterns in case Shopee changes only the path while keeping shopee.vn.
  if (path.includes('/share-video/') || path.includes('/video/')) return 'VIDEO';
  if (url.searchParams.get('type') === 'live' || path.includes('/live/')) return 'LIVE';

  return 'OTHER';
}
