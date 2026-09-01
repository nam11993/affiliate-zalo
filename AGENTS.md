# Codex project instructions

## Project goal
Build Phase 1 of a Shopee Affiliate bot intended to be connected to a Zalo group later.

The Phase 1 contract is intentionally narrow:
1. Accept a Shopee URL sent by a user.
2. Resolve Shopee short URLs such as `https://vn.shp.ee/...` or `https://s.shopee.vn/...`.
3. Canonicalize the final Shopee URL and extract `shopId` + `itemId` when it is a product.
4. Create an affiliate URL owned by the configured affiliate account.
5. Add deterministic tracking context via Shopee `sub_id` / Open API `subIds` so later phases can map conversions back to a Zalo user/click.
6. If Shopee Affiliate Open API credentials are configured, use `productOfferV2` to fetch product metadata and estimated commission, and use `generateShortLink` for a short affiliate URL.
7. Do NOT generate production affiliate links via a hand-built `an_redir` fallback while Shopee Open API approval is pending. Affiliate-link generation is temporarily blocked until `generateShortLink` can be tested with the account's approved AppId/Secret.
8. Build the Zalo integration independently so it can be completed before Shopee Open API approval.

## Non-goals for Phase 1
Do not implement orders, conversion reconciliation, wallet, bank account, withdrawal, admin dashboard, or payment.
Do not scrape Shopee HTML for commission data.
Do not fabricate commission when Open API data is unavailable.
Do not depend on undocumented Zalo group APIs in the core Shopee service.

## Engineering rules
- Node.js 20+; keep dependencies at zero until a dependency clearly improves reliability.
- Secrets only via environment variables. Never commit API secrets/cookies/tokens.
- Validate Shopee hosts before following redirects to reduce SSRF risk.
- Keep Shopee logic independent from Zalo so adapters can be replaced later.
- Prefer pure functions and unit tests for URL parsing, affiliate-link creation, sub-id generation, and message rendering.
- Open API signature must hash the exact JSON payload that is sent.
- Commission shown to users must be labeled as estimated and must display the raw `commission` value returned by Shopee Open API, with no tax/share/payout adjustments.
- Current project decision: pause final Shopee affiliate-link generation until Open API access is approved; next implementation focus is Zalo group message automation.

## Known project test pair
Original: `https://vn.shp.ee/FzQcBoQr`
Affiliate sample: `https://s.shopee.vn/AAGnbNuWQs`
The sample affiliate redirect previously indicated `utm_source=an_17345830644`; therefore `.env.example` uses `17345830644` as a provisional affiliate ID. Confirm before production.

## Messaging router decision (2026-09-01)
Before connecting a live Zalo account, Phase 1 must be testable with a transport-independent message pipeline:
`normalize -> guards/dedupe -> parser -> router -> handler -> fixed template -> reply metadata`.
The personal Zalo adapter is only a transport layer. It must eventually map a live Zalo event into the normalized shape and map `reply.text`, `reply.quoteMessageId`, and `reply.mentions` back to Zalo send APIs.
Do not put Shopee/business rules directly inside the Zalo listener.
Use `/simulator` and `/api/v1/messages/simulate` for local response testing. Mock affiliate data is simulator-only and must never be presented as real Shopee output.

## Short-link classification rule (mandatory)
- Treat `vn.shp.ee`, `s.shopee.vn`, `shp.ee`, and `shopee.page.link` as `SHORT`, never as `PRODUCT`.
- Resolve the short URL before business routing.
- Classify the final Shopee URL as `PRODUCT`, `VIDEO`, `LIVE`, or `OTHER`.
- `VIDEO`/`LIVE`: reply with the fixed unsupported-media template and ask for a product-detail link.
- Only `PRODUCT` may continue to `productOfferV2` / `generateShortLink`.
- If resolution fails or still ends at a short URL, do not fabricate an affiliate response.
