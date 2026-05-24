# sepay-playground

A minimal developer playground for the **SePay VietQR** flow:

1. User enters a VND amount → server mints an order code.
2. App renders the VietQR served by `qr.sepay.vn` and polls for status.
3. Customer scans + transfers → bank → SePay → webhook hits `/api/webhooks/sepay`.
4. Order flips to `paid`, UI updates.

Built with **SvelteKit 2** (Svelte 5 runes) + **JavaScript** + **pnpm** + **Tailwind v4** + **Upstash Redis** + **adapter-vercel** (Node runtime).

> Demo only. No real settlement, no auth, no users.

## Layout

```
src/
├── app.css                          # Tailwind v4 @theme tokens
├── app.html
├── lib/
│   ├── components/                  # PayForm / PayAwaiting / PayPaid
│   ├── server/
│   │   ├── redis.js                 # Redis.fromEnv()
│   │   ├── orders.js                # createOrder / getOrder / markPaid / claimWebhookId
│   │   └── sepay.js                 # buildQrUrl / verifyWebhookAuth / extractOrderCode
│   └── types.js                     # JSDoc typedefs
└── routes/
    ├── +layout.svelte               # header / footer / ModeWatcher
    ├── +page.svelte                 # landing
    ├── pay/
    │   ├── +page.server.js          # load + form action
    │   └── +page.svelte             # state machine (form → awaiting → paid)
    └── api/
        ├── orders/[code]/+server.js
        ├── webhooks/sepay/+server.js
        └── dev/simulate-webhook/+server.js  # dev-only, double-gated
```

## Setup

```sh
pnpm install
cp .env.example .env.local
# fill in real values — see below
pnpm dev
```

### Env vars

| Name                       | Where                                                                     | Notes                                                                   |
| -------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `SEPAY_WEBHOOK_API_KEY`    | SePay dashboard                                                           | Compared via `crypto.timingSafeEqual` against `Authorization: Apikey …` |
| `SEPAY_ACCOUNT_NUMBER`     | SePay-linked bank account                                                 | Embedded in QR URL                                                      |
| `SEPAY_BANK_CODE`          | `https://qr.sepay.vn/banks.json`                                          | Either short name (`Vietcombank`) or code (`VCB`)                       |
| `SEPAY_ORDER_PREFIX`       | Must match **SePay dashboard → Company Settings → General Configuration** | `SEVQR` works for VietinBank                                            |
| `UPSTASH_REDIS_REST_URL`   | Upstash console                                                           | Auto-loaded by `Redis.fromEnv()`                                        |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash console                                                           | Same                                                                    |
| `DEV_SIMULATE_TOKEN`       | Local-only                                                                | Random string; required header for `/api/dev/simulate-webhook`          |

### Local webhook delivery

SePay needs a public URL. Tunnel SvelteKit's dev port via ngrok:

```sh
ngrok http 5173
```

Take the `https://*.ngrok-free.app` URL and paste it into the SePay dashboard webhook config as `<url>/api/webhooks/sepay`. ngrok rotates per restart — re-paste each time.

### Simulating a webhook without a real transfer

Dev-only, gated on (a) `vite dev` and (b) the `DEV_SIMULATE_TOKEN` header.

```sh
# create an order in the UI first to get a code, then:
curl -X POST http://localhost:5173/api/dev/simulate-webhook \
  -H "x-dev-token: $DEV_SIMULATE_TOKEN" \
  -H "content-type: application/json" \
  -d '{"code":"SEVQRABC123"}'

# force the content-regex fallback path:
curl -X POST http://localhost:5173/api/dev/simulate-webhook \
  -H "x-dev-token: $DEV_SIMULATE_TOKEN" \
  -H "content-type: application/json" \
  -d '{"code":"SEVQRABC123","corrupt":true}'
```

## Deploy

```sh
pnpm dlx vercel
pnpm dlx vercel env add SEPAY_WEBHOOK_API_KEY     # repeat per var × per env
pnpm dlx vercel deploy --prod
```

`adapter-vercel` is wired to `runtime: 'nodejs20.x'` in `svelte.config.js` — webhook stays off the edge so `node:crypto` works.

> Vercel **preview** deployments are publicly reachable and `dev === false` there, so the simulate-webhook endpoint returns 404. Real webhooks still work on previews if you point a SePay env at the preview URL.

## Design notes

- Technical-minimal: neutral grays + indigo accent + 4px radius + monospace for codes/amounts.
- All tokens live in `src/app.css` under `@theme` (light) and `.dark` (dark via `mode-watcher`).
- State machine on `/pay` is a single route — `view` is `$derived` from `data.order.status`. Transitions are 150ms fade, suppressed under `prefers-reduced-motion: reduce`.
- Polling: `$effect` owns a `setInterval` + `AbortController`; runs an immediate fetch on mount to handle the webhook-before-poll race; stops on `paid` or 15-min expiry.

## Webhook contract (what this app expects from SePay)

- Method: `POST`
- Header: `Authorization: Apikey <SEPAY_WEBHOOK_API_KEY>` (scheme is case-insensitive)
- Body: JSON matching the typedef in `src/lib/types.js` (`SepayWebhookPayload`)
- Response: always `200 {"success": true, …}` within 30s; `401` only for bad auth
- Dedup: keyed on `payload.id` via `redis.set(... , nx:true, ex:7d)`
- Match: prefers `payload.code`, falls back to regex `/SEVQR[A-Z0-9]{6}/` on `payload.content`
- Outgoing transfers (`transferType === "out"`) are acknowledged and ignored

## Known limits

- No real auth / users — every order is publicly readable by code.
- No retry/backoff on the order GET endpoint — Upstash free tier survives but watch the metering.
- 15-min UI expiry is cosmetic; server still accepts a late webhook (it'll log an orphan if the Redis order TTL — 24h — already lapsed).
- `SEPAY_API_TOKEN` from the SePay dashboard is **not** used by this app (the webhook key alone is sufficient for inbound). Omit it from `.env.local`.
