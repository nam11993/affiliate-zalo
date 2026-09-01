import crypto from 'node:crypto';

export class ShopeeAffiliateOpenApi {
  constructor({ appId, secret, endpoint = 'https://open-api.affiliate.shopee.vn/graphql', timeoutMs = 12000, fetchImpl = fetch }) {
    this.appId = appId;
    this.secret = secret;
    this.endpoint = endpoint;
    this.timeoutMs = timeoutMs;
    this.fetchImpl = fetchImpl;
  }

  async request(query, variables = {}) {
    if (!this.appId || !this.secret) throw new Error('Thiếu Shopee Open API App ID/Secret.');

    // IMPORTANT: signature is calculated from the exact payload string sent over HTTP.
    const payload = JSON.stringify({ query, variables });
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = crypto
      .createHash('sha256')
      .update(`${this.appId}${timestamp}${payload}${this.secret}`, 'utf8')
      .digest('hex');

    const authorization = `SHA256 Credential=${this.appId}, Timestamp=${timestamp}, Signature=${signature}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(this.endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          'accept': 'application/json',
          'authorization': authorization
        },
        body: payload
      });
      const text = await response.text();
      let body;
      try { body = JSON.parse(text); } catch { throw new Error(`Shopee Open API trả dữ liệu không phải JSON (HTTP ${response.status}).`); }
      if (!response.ok) throw new Error(`Shopee Open API HTTP ${response.status}: ${JSON.stringify(body).slice(0, 500)}`);
      if (body.errors?.length) throw new Error(`Shopee Open API GraphQL: ${body.errors.map(e => e.message || JSON.stringify(e)).join('; ')}`);
      return body.data;
    } finally {
      clearTimeout(timer);
    }
  }

  async generateShortLink(originUrl, subIds = []) {
    const query = `
      mutation GenerateShortLink($originUrl: String!, $subIds: [String]) {
        generateShortLink(input: { originUrl: $originUrl, subIds: $subIds }) {
          shortLink
        }
      }
    `;
    const data = await this.request(query, { originUrl, subIds: subIds.slice(0, 5) });
    return data?.generateShortLink?.shortLink || null;
  }

  async getProductOffer({ shopId, itemId }) {
    const query = `
      query ProductOffer($shopId: Int64, $itemId: Int64) {
        productOfferV2(shopId: $shopId, itemId: $itemId, page: 1, limit: 10) {
          nodes {
            itemId
            shopId
            productName
            productLink
            offerLink
            imageUrl
            priceMin
            priceMax
            priceDiscountRate
            sales
            ratingStar
            commissionRate
            sellerCommissionRate
            shopeeCommissionRate
            commission
            shopName
            periodStartTime
            periodEndTime
          }
          pageInfo { page limit hasNextPage }
        }
      }
    `;
    // Int64 is commonly represented by numeric JSON values in Shopee's schema.
    const variables = { shopId: Number(shopId), itemId: Number(itemId) };
    const data = await this.request(query, variables);
    const nodes = data?.productOfferV2?.nodes || [];
    return nodes.find(n => String(n.shopId) === String(shopId) && String(n.itemId) === String(itemId)) || nodes[0] || null;
  }
}
