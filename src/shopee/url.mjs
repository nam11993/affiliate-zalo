const SHOPEE_HOSTS = new Set([
  'shopee.vn',
  'www.shopee.vn',
  's.shopee.vn',
  'vn.shp.ee',
  'shp.ee',
  'shopee.page.link'
]);

export function isAllowedShopeeHost(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/\.$/, '');
  return SHOPEE_HOSTS.has(host) || host.endsWith('.shopee.vn');
}

export function assertShopeeUrl(input) {
  let url;
  try {
    url = new URL(input);
  } catch {
    throw new Error('URL không hợp lệ.');
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Chỉ hỗ trợ URL http/https.');
  if (!isAllowedShopeeHost(url.hostname)) throw new Error(`Không hỗ trợ domain: ${url.hostname}`);
  return url;
}

function extractShopeeUrlFromHtml(html, baseUrl) {
  if (!html) return null;
  const unescaped = String(html).replaceAll('\\/', '/').replaceAll('&amp;', '&');
  const patterns = [
    /https?:\/\/sv\.shopee\.vn\/[^"'<>\s]+/i,
    /https?:\/\/live\.shopee\.vn\/[^"'<>\s]+/i,
    /https?:\/\/(?:www\.)?shopee\.vn\/[^"'<>\s]+/i,
    /(?:window\.)?location(?:\.href)?\s*=\s*["']([^"']+)["']/i,
    /location\.replace\(\s*["']([^"']+)["']\s*\)/i,
    /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i,
    /<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i,
    /url\s*=\s*["']?([^"';>\s]+)/i
  ];

  for (const pattern of patterns) {
    const match = unescaped.match(pattern);
    if (!match) continue;
    const value = match[1] || match[0];
    try {
      const candidate = new URL(value, baseUrl);
      if (isAllowedShopeeHost(candidate.hostname) && candidate.toString() !== baseUrl.toString()) {
        return candidate;
      }
    } catch {}
  }
  return null;
}

export async function resolveShopeeUrl(input, { timeoutMs = 10000, maxRedirects = 8, fetchImpl = fetch } = {}) {
  let current = assertShopeeUrl(input);

  for (let i = 0; i <= maxRedirects; i++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(current, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'user-agent': 'Mozilla/5.0 ShopeeAffiliatePhase1/0.1',
          'accept': 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8'
        }
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location) throw new Error(`Redirect ${response.status} thiếu Location.`);
        const next = new URL(location, current);
        if (!isAllowedShopeeHost(next.hostname)) throw new Error(`Shopee redirect sang domain không được phép: ${next.hostname}`);
        current = next;
        continue;
      }

      const effective = response.url ? new URL(response.url) : current;
      if (!isAllowedShopeeHost(effective.hostname)) throw new Error(`URL cuối không thuộc Shopee: ${effective.hostname}`);

      const contentType = response.headers?.get?.('content-type') || '';
      if (contentType.includes('text/html') || current.hostname.includes('shp.ee') || current.hostname === 's.shopee.vn') {
        try {
          const html = await response.text();
          const embedded = extractShopeeUrlFromHtml(html, effective);
          if (embedded) {
            current = embedded;
            continue;
          }
        } catch {}
      }
      return effective.toString();
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error(`Quá ${maxRedirects} lần redirect.`);
}

export function extractProductIdentity(input) {
  const url = assertShopeeUrl(input);
  const path = decodeURIComponent(url.pathname);

  let match = path.match(/\/product\/(\d+)\/(\d+)/i);
  if (match) return { shopId: match[1], itemId: match[2] };

  match = path.match(/-i\.(\d+)\.(\d+)(?:\/|$)/i);
  if (match) return { shopId: match[1], itemId: match[2] };

  match = path.match(/\/opaanlp\/(\d+)\/(\d+)/i);
  if (match) return { shopId: match[1], itemId: match[2] };

  const shopId = url.searchParams.get('shopid') || url.searchParams.get('shopId');
  const itemId = url.searchParams.get('itemid') || url.searchParams.get('itemId');
  if (shopId && itemId && /^\d+$/.test(shopId) && /^\d+$/.test(itemId)) return { shopId, itemId };

  return null;
}

export function canonicalizeShopeeUrl(input) {
  const url = assertShopeeUrl(input);
  const identity = extractProductIdentity(url.toString());
  if (identity) return `https://shopee.vn/product/${identity.shopId}/${identity.itemId}`;

  const clean = new URL(url.toString());
  clean.protocol = 'https:';
  if (clean.hostname === 'www.shopee.vn') clean.hostname = 'shopee.vn';

  const removePrefixes = ['utm_', 'uls_'];
  const removeExact = new Set(['affiliate_id', 'sub_id', 'smtt', 'sp_atk', 'xptdk']);
  for (const key of [...clean.searchParams.keys()]) {
    if (removeExact.has(key) || removePrefixes.some(prefix => key.toLowerCase().startsWith(prefix))) clean.searchParams.delete(key);
  }
  clean.hash = '';
  return clean.toString();
}
