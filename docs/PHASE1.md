# Phase 1 specification

## User story
A user drops a Shopee product link in a Zalo group. The personal Zalo account listener classifies the message, routes it to the Shopee handler, and replies using a fixed template. Final affiliate-link generation and commission lookup will be activated after Shopee Open API access is approved.

## Messaging pipeline

```text
Zalo event (later)
  -> normalize message
  -> guards / dedupe
  -> parse intent
  -> route handler
  -> fixed reply template
  -> reply metadata: text + quoteMessageId + mentions
```

Recognized intents today:
- `#vitien`
- `#donhang`
- `#bank <args>`
- `#ruttien`
- `#id`
- one or more Shopee URLs embedded anywhere in text
- normal text -> ignore

Commands are parsed but their business handlers stay disabled in Phase 1.

## Shopee pipeline after Open API approval

```text
Shopee URL
  -> resolve short URL
  -> canonicalize URL
  -> extract shopId/itemId
  -> create per-user/per-click subIds
  -> productOfferV2
  -> use raw `commission` as displayed estimated commission
  -> generateShortLink
  -> render reply
```

There is deliberately no production `an_redir` fallback while API approval is pending.

## Local simulator

Run:

```bash
npm start
```

Open:

```text
http://localhost:3000/simulator
```

The simulator injects mock Shopee product/commission/link data only to preview the final Zalo response. It does not claim mock data is real.

## API

### POST /api/v1/messages/simulate
Tests normalize/parser/router/template without a live Zalo session.

### POST /api/v1/affiliate/convert
Low-level Shopee conversion service. Without approved Open API credentials it resolves/parses/tracks but returns `affiliateUrl: null` and `affiliateSource: pending_open_api`.

## Commission rule
Display the raw numeric value returned by `productOfferV2.commission` as `Hoa hồng ước tính`. Do not subtract tax, do not apply revenue share, and do not calculate a user payout in Phase 1.

## Security
- No secrets in source control.
- Redirects are restricted to Shopee hosts.
- Ignore self-sent messages to prevent bot loops.
- Zalo transport stays separate from parser/router/business logic.
