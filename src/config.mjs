import fs from 'node:fs';
import path from 'node:path';

function loadDotEnv(file = '.env') {
  const fullPath = path.resolve(process.cwd(), file);
  if (!fs.existsSync(fullPath)) return;
  const text = fs.readFileSync(fullPath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx < 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadDotEnv();

const asBool = (v, fallback = false) => v == null ? fallback : !['0', 'false', 'no', 'off'].includes(String(v).toLowerCase());
const asNumber = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export const config = Object.freeze({
  port: asNumber(process.env.PORT, 3000),
  shopeeAffiliateId: process.env.SHOPEE_AFFILIATE_ID?.trim() || '',
  shopeeApiAppId: process.env.SHOPEE_API_APP_ID?.trim() || '',
  shopeeApiSecret: process.env.SHOPEE_API_SECRET?.trim() || '',
  shopeeApiUrl: process.env.SHOPEE_API_URL?.trim() || 'https://open-api.affiliate.shopee.vn/graphql',
  shopeeOpenApiEnabled: asBool(process.env.SHOPEE_OPEN_API_ENABLED, true),
  resolveTimeoutMs: asNumber(process.env.SHOPEE_RESOLVE_TIMEOUT_MS, 10000),
  apiTimeoutMs: asNumber(process.env.SHOPEE_API_TIMEOUT_MS, 12000)
});

export function hasOpenApiCredentials(cfg = config) {
  return Boolean(cfg.shopeeOpenApiEnabled && cfg.shopeeApiAppId && cfg.shopeeApiSecret);
}
