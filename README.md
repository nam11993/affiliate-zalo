# Shopee Affiliate Zalo Bot — Phase 1

## Cập nhật: short link là luồng mặc định

Phần lớn link user copy từ Shopee là link rút gọn. Hệ thống **không được đoán short link là sản phẩm**. Luồng chuẩn hiện tại:

```text
User dán vn.shp.ee / s.shopee.vn / shp.ee
        ↓
Resolve HTTP redirect / HTML bridge
        ↓
Lấy URL cuối
        ↓
PRODUCT → đi tiếp luồng Affiliate
VIDEO   → phản hồi yêu cầu gửi link sản phẩm
LIVE    → phản hồi yêu cầu gửi link sản phẩm
OTHER   → báo không phải trang chi tiết sản phẩm
```

### Test nhanh trên Windows — không cần npm

1. Giải nén project.
2. Double-click `TEST_NHANH_WINDOWS.bat`.
3. Trình duyệt mở `http://127.0.0.1:8765/`.
4. Dán **short link thật** vào ô `Tin nhắn Zalo giả lập`.
5. Bấm `Phân tích & tạo phản hồi`.

File BAT chạy một local resolver bằng PowerShell có sẵn trên Windows. Nó follow redirect thật của Shopee rồi trả về `PRODUCT / VIDEO / LIVE / OTHER`.

> Không mở `SIMULATOR_STANDALONE.html` trực tiếp nếu muốn test short link bất kỳ, vì browser bị giới hạn CORS khi tự follow redirect cross-domain.

---

# Shopee Affiliate Zalo Bot — Phase 1

Codex-ready starter for the first phase discussed in this project: **Shopee link in → tracked affiliate link out**, with optional product metadata and estimated commission from Shopee Affiliate Open API. Phase 1 displays the API `commission` value directly, with no tax/share/payout calculation.

## What works now

- Shopee URL validation.
- Short-link redirect resolver with Shopee-domain allowlist.
- Product `shopId` / `itemId` extraction.
- Canonical product URL generation.
- Per-user/per-click tracking identifiers.
- Affiliate link generation adapter prepared for Shopee Open API `generateShortLink`; production generation is paused until this account receives Open API credentials.
- Optional Shopee Affiliate Open API client:
  - `productOfferV2`
  - `generateShortLink`
- Zalo-ready reply text.
- HTTP endpoint and unit tests.

## Phase 1 intentionally excludes
Orders, conversion reconciliation, wallet, `#donhang`, `#vitien`, `#bank`, `#ruttien`, admin portal and payments.

## Setup

Requires Node.js 20+.

```bash
cp .env.example .env
npm test
npm start
```

The project has zero npm runtime dependencies.

### Configuration

At minimum set:

```env
SHOPEE_AFFILIATE_ID=17345830644
```

`17345830644` was inferred from the affiliate link sample supplied during project analysis; verify it in your own Shopee Affiliate account before production.

For product information, estimated commission and Shopee short links, add Open API credentials:

```env
SHOPEE_API_APP_ID=...
SHOPEE_API_SECRET=...
SHOPEE_API_URL=https://open-api.affiliate.shopee.vn/graphql
```

Never commit `.env`.

## Test the API

Start:

```bash
npm start
```

Then:

```bash
curl -X POST http://localhost:3000/api/v1/affiliate/convert \
  -H "Content-Type: application/json" \
  -d '{
    "url":"https://vn.shp.ee/FzQcBoQr",
    "userId":"U000123",
    "displayName":"Thanh"
  }'
```

Expected behavior:

### Without Open API credentials
The app may resolve and parse the Shopee URL, but it must not claim a generated production affiliate URL. Final affiliate-link generation is intentionally paused while Open API approval is pending.

### With Open API credentials
The app queries `productOfferV2` for product metadata/raw estimated commission and uses `generateShortLink` for the affiliate URL. No fallback link should be presented as production-ready if Open API fails.

## Zalo integration — next focus

Current project decision: proceed with the Zalo side while Shopee Open API approval is pending. The reference screenshots appear to use a normal personal Zalo account rather than an OA identity. Official Zalo developer APIs primarily cover Official Accounts; a personal-account implementation therefore needs a separate adapter and must be treated as unofficial/fragile if it relies on Zalo Web session automation.

`POST /api/v1/zalo/webhook-demo` remains only an adapter-shaped demo until the chosen Zalo path is implemented.

Example intended reply:

```text
@Thanh ơi, mua qua link này nhé 👇

🛍 <tên sản phẩm nếu Open API trả về>
👉 https://s.shopee.vn/...
🌷 Hoa hồng ước tính: <nguyên giá trị commission từ API>
```

## Current Shopee integration status

Shopee Open API access is pending. The production path intentionally does **not** construct an `an_redir` fallback. Once AppId/Secret are approved, enable `productOfferV2` + `generateShortLink` and display the raw API `commission` value.


## TEST KHÔNG CẦN NODE / NPM (Windows)

Nếu máy chưa cài Node.js, không cần cài gì chỉ để test parser/template.

Cách nhanh nhất:
1. Double-click `TEST_NHANH_WINDOWS.bat`, hoặc mở trực tiếp `SIMULATOR_STANDALONE.html` bằng Chrome/Edge.
2. Nhập tin nhắn Zalo giả lập và mock dữ liệu Shopee.
3. Bấm `Phân tích & tạo phản hồi`.

Standalone simulator chạy 100% trong browser, không gọi Zalo thật và không gọi Shopee Open API.

Khi bắt đầu chạy backend/Zalo listener thật mới cần Node.js 20+.

### Simulator: Video/Live short-link behavior
- Dán link gốc vào ô **Tin nhắn Zalo giả lập**.
- Không dán link gốc vào ô **URL cuối sau resolve**; ô này chỉ là mock nâng cao.
- Nút **Video short link** dùng fixture của case `https://vn.shp.ee/58nvmrdm?smtt=0.0.9` và mô phỏng URL cuối thuộc `sv.shopee.vn`, nên sẽ trả đúng mẫu `Link Video/Live Shopee không đổi được affiliate...`.
- Với một short link lạ, standalone offline sẽ báo `SHORT_LINK_NEEDS_SERVER_RESOLVE` thay vì nhầm nó thành product. Khi chạy bot thật, backend sẽ tự follow redirect rồi phân loại.

### Windows simulator - lỗi `$Host` read-only
Nếu gặp lỗi `Cannot overwrite variable Host because it is read-only or constant`, đó là do Windows PowerShell có biến hệ thống `$Host` chỉ đọc. Bản hiện tại đã đổi biến nội bộ sang `$urlHost` và đồng thời tránh dùng biến tự động `$input` cho request URL.
