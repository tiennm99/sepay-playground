# SePay Payment Integration Research

## 1. VietQR Image Generation Endpoint

**Endpoint:** `https://qr.sepay.vn/img`

**Required Query Parameters:**
- `acc`: Bank account/virtual account number
- `bank`: Bank code or short name (from `qr.sepay.vn/banks.json`)

**Optional Parameters:**
- `amount`: Transfer amount in VND
- `des`: Transfer memo/description (this is where order codes embed)
- `template`: Display style (`default`, `compact`, `qronly`). Defaults to full QR.
- `download`: Set to `true` to force download instead of inline display

**Example:**
```
https://qr.sepay.vn/img?acc=0010000000355&bank=Vietcombank&amount=100000&des=ORDER123
```

**Sources:** [SePay QR Code Guide](https://docs.sepay.vn/tao-qr-code-vietqr-dong.html), [SePay Developer QR Docs](https://developer.sepay.vn/en/tien-ich-khac/tao-qr-code)

---

## 2. Webhook Payload Fields

**POST Endpoint:** Your configured webhook URL receives JSON:

```json
{
  "id": 92704,
  "gateway": "Vietcombank",
  "transactionDate": "2023-03-25 14:02:37",
  "accountNumber": "0123499999",
  "code": "ORDER123",
  "content": "transfer to buy iphone",
  "transferType": "in",
  "transferAmount": 2277000,
  "accumulated": 19077000,
  "subAccount": null,
  "referenceCode": "MBVCB.3278907687",
  "description": ""
}
```

**Field Mapping:**
- `id`: Unique transaction ID (use for deduplication)
- `code`: **Extracted** order code (auto-matched by SePay config; can be `null`)
- `content`: Raw transfer memo from bank (source for manual extraction)
- `referenceCode`: Bank's internal reference (immutable)
- `transferType`: `"in"` (incoming) or `"out"` (outgoing)
- `accumulated`: Account balance after transfer

**Which field for order matching?**
- Prefer `code` if configured in dashboard to auto-extract (more reliable)
- Fall back to `content` if `code` is `null` (use pattern matching)

**Sources:** [SePay Webhook Integration](https://docs.sepay.vn/tich-hop-webhooks.html), [Webhook Programming](https://developer.sepay.vn/en/sepay-webhooks/lap-trinh-webhook)

---

## 3. Webhook Authentication

**Method:** API Key in `Authorization` header

**Header Format:**
```
Authorization: Apikey YOUR_SEPAY_API_KEY
```

**Configuration:**
- Generate/retrieve key from **SePay Dashboard → Settings → API Keys** (exact location unconfirmed in docs)
- Laravel package refers to this as **webhook token** in `.env`
- No additional signature validation required if using API Key auth

**Alternative Auth Methods (optional):**
- HMAC-SHA256 signature in header
- OAuth 2.0 tokens
- No auth (not recommended for production)

**Sources:** [SePay Webhook Docs](https://docs.sepay.vn/tich-hop-webhooks.html), [Laravel SePay Package](https://github.com/sepayvn/laravel-sepay)

---

## 4. Order Code Extraction (Auto-Matching)

**Configuration Location:** Dashboard → Company Settings → General Configuration

**Extraction Rules:**
- **Pattern prefix:** Configurable in SePay dashboard (e.g., `SE`, `SEVQR`, `SEPAY`, or custom)
- **Default pattern:** Often `SE` (seen in Laravel implementation)
- **Format:** Prefix + alphanumeric code in transfer `content` field
- **Examples:**
  - Transfer memo: `"SEVQR123456..."` → extracted `code: "123456"`
  - Transfer memo: `"PAYOrder789"` → extracted `code: "789"` (if `PAY` configured)

**VietinBank Special Rule:**
- Requires memo format: `"SEVQR" + transfer_content` for QR transfers

**Webhook Field:** Auto-extracted code appears in `code` field (null if no match)

**Manual Extraction Fallback:**
- If `code` is null, regex-parse `content` field using dashboard-configured pattern

**Sources:** [SePay Webhook Integration](https://docs.sepay.vn/tich-hop-webhooks.html), [Laravel SePay Implementation](https://github.com/sepayvn/laravel-sepay)

---

## 5. Webhook Retries & Idempotency

**Retry Behavior:**
- **Failed webhooks:** Auto-retry up to **7 times** over max **5-hour window**
- **Retry interval:** Fibonacci-spaced delays
- **Success criteria:** HTTP 200/201 + JSON body `{"success": true}` within 30 seconds

**Deduplication (CRITICAL):**
- **Stable ID:** `id` field is immutable per transaction and remains constant across all retries
- **Dedup strategy:**
  - Create `UNIQUE` constraint on `(gateway, transactionDate, accountNumber, transferAmount)` or just `id`
  - Check if `id` exists before processing; return 200 if duplicate detected
  - Use `INSERT IGNORE` or conditional insert to prevent race conditions

**Guaranteed Dedup:**
- Store processed `id` values in database with expiration >= 5 hours
- Check at transaction-start before queuing business logic

**Sources:** [SePay Webhook Docs](https://docs.sepay.vn/tich-hop-webhooks.html)

---

## 6. Bank Codes & Short Names

**Canonical List:** `https://qr.sepay.vn/banks.json` (JSON array of bank objects)

**JSON Structure (inferred):**
```json
[
  {
    "code": "ACB",
    "bin": "970416",
    "shortName": "ACB",
    "name": "Asia Commercial Bank"
  },
  {
    "code": "VCB",
    "shortName": "Vietcombank",
    "name": "Ngân hàng TMCP Ngoại Thương Việt Nam"
  },
  {
    "code": "MB",
    "shortName": "MBBank",
    "name": "Ngân hàng TMCP Quân Đội"
  }
]
```

**Parameter Acceptance:** QR endpoint accepts either `code` or `shortName` in `bank` param

**Common Banks (examples):**
- `Vietcombank` (short name)
- `ACB` (code)
- `MBBank` (short name)
- `VietinBank`, `BIDV`, `HDBank`, `Techcombank`, `SHB`, `OCB`, `KienLongBank`, `MSB`

**Bank-Specific Rules:**
- **OCB, KienLongBank, MSB:** Require virtual accounts
- **VietinBank:** Personal/business transfers require `SEVQR` prefix in memo

**Sources:** [SePay QR Developer Docs](https://developer.sepay.vn/en/tien-ich-khac/tao-qr-code), [VietQR API Banks](https://api.vietqr.vn/vi/danh-sach-ma-ngan-hang)

---

## Implementation Checklist for Next.js

- [ ] Fetch & cache `qr.sepay.vn/banks.json` at startup
- [ ] Build QR URL with `acc`, `bank`, `amount`, `des` (embed order ID in `des`)
- [ ] Create `/api/webhooks/sepay` route to receive POSTs
- [ ] Validate `Authorization: Apikey` header matches env config
- [ ] Check `id` field exists in database before processing (dedup)
- [ ] Extract order code from `code` field (preferred) or parse `content` (fallback)
- [ ] Insert webhook record into DB with `INSERT IGNORE` to ensure idempotency
- [ ] Return `{success: true}` within 30s; queue business logic asynchronously
- [ ] Update order status on successful match
- [ ] Log unmatched transactions for manual review

---

## Unresolved Questions

1. **Dashboard API Key field name:** Exact label in SePay dashboard for webhook auth key (docs reference step 3.3 but no UI screenshots provided)
2. **banks.json schema:** Confirmed endpoint exists but structure inferred from VietQR API; SePay-specific field names unverified
3. **Code extraction config:** Exact UI path and format for dashboard pattern configuration (location varies by docs version)
4. **VietinBank SEVQR requirement:** Confirmation if this applies to all transfer types or only QR-generated transfers
5. **Webhook signature validation:** If using API Key, are additional HMAC/signature headers expected? (docs mention option but don't clarify when required)

---

## Sources Consulted

- [SePay Official Docs - QR Code](https://docs.sepay.vn/tao-qr-code-vietqr-dong.html)
- [SePay Developer - QR Generation](https://developer.sepay.vn/en/tien-ich-khac/tao-qr-code)
- [SePay Official Docs - Webhooks](https://docs.sepay.vn/tich-hop-webhooks.html)
- [SePay Developer - Webhook Integration](https://developer.sepay.vn/en/sepay-webhooks/tich-hop-webhook)
- [SePay Developer - Webhook Programming](https://developer.sepay.vn/en/sepay-webhooks/lap-trinh-webhook)
- [Laravel SePay Package](https://github.com/sepayvn/laravel-sepay)
- [VietQR API Bank Codes](https://api.vietqr.vn/vi/danh-sach-ma-ngan-hang)
- [SePay Blog - Free QR Creation](https://sepay.vn/blog/tao-ma-qr-ngan-hang-mien-phi-huong-dan-nhanh/)
