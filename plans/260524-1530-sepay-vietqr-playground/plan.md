---
title: 'SePay VietQR demo playground — implementation plan'
description: 'SvelteKit 2 + Svelte 5 runes demo: order form → QR awaiting (poll) → paid, backed by Upstash Redis + SePay webhook with dev simulator.'
status: pending
priority: P2
effort: 6h
branch: main
tags: [sveltekit, svelte5, tailwindv4, shadcn-svelte, upstash-redis, sepay, vercel]
created: 2026-05-24
---

# SePay VietQR Playground — Implementation Plan

Stack is locked per `docs/tech-stack.md`. This plan orders scaffolding → infra → routes → UI → dev tools → polish. Each phase is independently revertible. Total LOC budget ~600 lines.

## Tooling compat notes (verified 2026-05)

- `create-svelte` is deprecated; use the unified **`sv` CLI** (`pnpm dlx sv create`). Add-ons go via `--add`; JS via `--no-types`; package manager via `--install pnpm`.
- `shadcn-svelte@latest` CLI initializes projects with Tailwind v4 + Svelte 5 by default. Run `shadcn-svelte init` AFTER `sv create` because it expects an existing Tailwind v4 setup (Vite plugin, `@import "tailwindcss"` in `app.css`).
- Tailwind v4 uses the **`@tailwindcss/vite`** plugin (not PostCSS) and removes `tailwind.config.js` in favor of CSS-first `@theme` blocks. Do NOT create `tailwind.config.js` or `postcss.config.js`.
- shadcn-svelte under Svelte 5: `Card.Root`/`Card.Header` are namespaced exports. `mode-watcher` v0.5+ ships Svelte 5 runes-ready.
- `@upstash/redis` v1.34+ — `Redis.fromEnv()` reads `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`. Works in Node runtime; no edge tweaks.
- `@sveltejs/adapter-vercel` v5.x — pin runtime via `adapter({ runtime: 'nodejs20.x' })`.

---

## Phase 1 — Scaffold project (goal: empty SvelteKit app runs)

```bash
# from repo root (sepay-playground/)
pnpm dlx sv@latest create . --no-types --template minimal --add tailwindcss --add prettier --install pnpm
pnpm add -D @sveltejs/adapter-vercel@^5
pnpm remove @sveltejs/adapter-auto
```

- Choose **minimal** template (no demo routes).
- Edit `package.json` → add `"packageManager": "pnpm@9.x"`.
- Add `.npmrc` with `shamefully-hoist=false` and `engine-strict=true`.
- Smoke: `pnpm dev` should serve on :5173 with a blank page.

## Phase 2 — Configure adapter, runtime, env (goal: build target locked)

- `svelte.config.js`: import `adapter-vercel`, set `kit.adapter = adapter({ runtime: 'nodejs20.x' })`.
- Create `.env.example` mirroring `docs/tech-stack.md` env table (7 vars).
- `src/app.d.js` (or `app.d.ts` deleted) — skip; not using TS.
- `jsconfig.json`: `{"compilerOptions":{"checkJs":false,"moduleResolution":"bundler"}, "include":["src/**/*"]}`.
- Add `src/lib/types.js` with JSDoc typedefs: `Order`, `SepayWebhookPayload` (mirror payload from `research-sepay.md`).

## Phase 3 — Tailwind v4 tokens + fonts + shadcn-svelte init (goal: design tokens addressable)

```bash
pnpm dlx shadcn-svelte@latest init  # base-color: neutral, style: default, css: src/app.css
pnpm dlx shadcn-svelte@latest add button input label card badge alert skeleton sonner alert-dialog
pnpm add mode-watcher lucide-svelte
```

- Edit `src/app.css`: keep `@import "tailwindcss";` then append a `@theme` block mapping tokens from `design-guidelines.md`:
  - `--color-bg`, `--color-surface`, `--color-border`, `--color-ink`, `--color-muted`, `--color-accent`, `--color-accent-hover`, `--color-success`, `--color-warning`, `--color-danger`.
  - Dark variants under `@media (prefers-color-scheme: dark)` / `.dark` selector (mode-watcher toggles `.dark` on `<html>`).
  - `--radius: 4px` (override shadcn default of `0.5rem`).
  - `--font-sans: Inter, system-ui, sans-serif`; `--font-mono: "JetBrains Mono", ui-monospace`.
- `src/app.html`: preconnect + Google Fonts link for Inter (400/500/600) + JetBrains Mono (400/500).
- Add `<ModeWatcher />` in `src/routes/+layout.svelte`.

## Phase 4 — Server libs: Redis + SePay helpers (goal: pure functions, no HTTP)

- `src/lib/server/redis.js` — `import { Redis } from '@upstash/redis'; export const redis = Redis.fromEnv();`.
- `src/lib/server/orders.js`:
  - `createOrder({ amount }) → { code, amount, status:'pending', createdAt }` — code = `${SEPAY_ORDER_PREFIX}${nanoid(6).toUpperCase()}`; `redis.set('order:'+code, order, { ex: 86400 })`.
  - `getOrder(code)` → `redis.get('order:'+code)` (auto-deserialized).
  - `markPaid(code, { paidAt, txId })` — read, mutate `status='paid'`, write back with same TTL.
- `src/lib/server/sepay.js`:
  - `buildQrUrl({ amount, code })` → returns `https://qr.sepay.vn/img?acc=...&bank=...&amount=...&des=...&template=compact` using `$env/static/private`.
  - `verifyWebhookAuth(request)` → checks `Authorization === 'Apikey ' + SEPAY_WEBHOOK_API_KEY`; returns boolean.
  - `extractOrderCode(payload)` → prefer `payload.code`; fallback regex `new RegExp(prefix + '([A-Z0-9]{6})')` on `payload.content`.
- `pnpm add @upstash/redis nanoid`.

## Phase 5 — API routes (goal: order + webhook endpoints functional)

- `src/routes/api/orders/[code]/+server.js`:
  - `export async function GET({ params })` → `getOrder(params.code)` → return `json({ status, amount, code, paidAt })` or 404 if null.
  - `Cache-Control: no-store`.
- `src/routes/api/webhooks/sepay/+server.js`:
  - `POST`: 401 if `!verifyWebhookAuth(request)`.
  - Parse JSON; if `transferType !== 'in'` → 200 `{success:true}` (ignore outgoing).
  - Dedup: `const fresh = await redis.set('webhook:'+payload.id, '1', { nx: true, ex: 604800 });` — if `fresh === null` → 200 `{success:true, deduped:true}`.
  - `extractOrderCode(payload)` → if no code → 200 `{success:true, unmatched:true}` + `console.warn` (don't 4xx; SePay will retry).
  - `getOrder(code)` → 200 if absent (still ack); else `markPaid(code, { paidAt: payload.transactionDate, txId: payload.referenceCode })`.
  - Always respond `{success:true}` within 30s.
- `src/routes/api/dev/simulate-webhook/+server.js`:
  - `POST`: guard `if (import.meta.env.PROD) return new Response('Not found', { status: 404 });`.
  - Body: `{ code, amount? }`. Build a fake `SepayWebhookPayload` (id = `Date.now()`, transferType `'in'`, gateway `'Vietcombank'`, etc.).
  - `fetch('/api/webhooks/sepay', { method: 'POST', headers: { Authorization: 'Apikey ' + SEPAY_WEBHOOK_API_KEY, 'content-type': 'application/json' }, body: JSON.stringify(payload) })` — calls the real handler so dedup/extract logic stays single-sourced.

## Phase 6 — `/pay` route: form action + state machine (goal: SSR happy path)

- `src/routes/pay/+page.server.js`:
  - `export const actions = { default: async ({ request }) => { const data = await request.formData(); const amount = Number(data.get('amount')); /* validate 1000..50_000_000 */ const order = await createOrder({ amount }); throw redirect(303, '/pay?code=' + order.code); } }`.
  - `export async function load({ url })` — if `?code=` present, `getOrder(code)` → return `{ order, qrUrl: buildQrUrl(order) }`.
- `src/routes/pay/+page.svelte`:
  - `let { data } = $props();`
  - `let view = $derived(!data.order ? 'form' : data.order.status === 'paid' ? 'paid' : 'awaiting');`
  - Mount `PayForm`, `PayAwaiting`, or `PayPaid` based on `view`. Use 150ms fade via Svelte `transition:fade={{duration:150}}`.
  - Honor `prefers-reduced-motion` (skip transition).

## Phase 7 — Pay components + polling (goal: pixel-accurate UI per wireframes)

- `src/lib/components/PayForm.svelte` — amount Input + Label, "Generate QR" Button, demo-amount link (sets value to 10000). Translates `docs/wireframe/pay-form.html`.
- `src/lib/components/PayAwaiting.svelte` — Card with QR (`<img src={qrUrl} width="240" height="240" alt="VietQR">`), Badge `pending`, meta grid (Amount/Order/Expires), "Cancel / new order" link.
  - Polling: `$effect(() => { const id = setInterval(async () => { const r = await fetch('/api/orders/' + code); const o = await r.json(); if (o.status === 'paid') invalidateAll(); }, 2000); return () => clearInterval(id); });`
  - Expiry countdown: 15-min timer; on expire show expired state + link to form.
- `src/lib/components/PayPaid.svelte` — success Badge, checkmark icon (lucide `Check`), paidAt timestamp, "New order" Button → `/pay`.
- `src/routes/+page.svelte` (landing) — brief intro + Button link to `/pay`. Translates `docs/wireframe/home.html`.
- `src/routes/+layout.svelte` — header (`sepay/playground`), `<ModeWatcher />`, container.

## Phase 8 — Verification + docs (goal: handoff-ready)

- `README.md` (new): env setup (`cp .env.example .env.local`), `pnpm install`, `pnpm dev`, ngrok command, SePay dashboard webhook URL config, `vercel deploy`.
- `.gitignore`: ensure `.env.local`, `.vercel`, `.svelte-kit`, `node_modules` covered (sv-create defaults usually suffice).
- Run `pnpm build` end-to-end; ensure adapter-vercel produces `.vercel/output/`.
- Run `pnpm svelte-check` skipped (JS-only project; `pnpm lint` + `pnpm format` instead).

---

## Risk register

| Risk                                                  | Likelihood | Impact | Mitigation                                                                                           |
| ----------------------------------------------------- | ---------- | ------ | ---------------------------------------------------------------------------------------------------- |
| shadcn-svelte init overwrites our `app.css` tokens    | M          | M      | Run init first (Phase 3), then append `@theme` block; commit before token edits                      |
| Webhook dedup race (two retries arrive within ms)     | L          | H      | `set nx` is atomic in Redis — only first call returns OK                                             |
| SePay sends `code: null` (auto-extract misconfigured) | M          | M      | Fallback regex on `content`; log + return 200 (no retry storm)                                       |
| Polling never stops if user leaves tab                | L          | L      | `$effect` cleanup on unmount; also stop after 15-min expiry                                          |
| Dev simulator reachable in prod                       | L          | H      | Guard `import.meta.env.PROD` at top of handler; also smoke-test against `pnpm build && pnpm preview` |
| Tailwind v4 `@theme` syntax drift                     | L          | M      | Pin `tailwindcss@^4.0` in package.json; doc inline `@theme` reference                                |

## Rollback per phase

Each phase = one commit. `git revert <hash>` undoes it without cascade because: (1) routes are added in Phase 5 after libs in Phase 4 exist, (2) UI components in Phase 7 only consume Phase 6 load data, (3) dev simulator (5c) is isolated under `/api/dev/`.

## File ownership (no overlap)

| Phase | Files exclusively owned                                                                                             |
| ----- | ------------------------------------------------------------------------------------------------------------------- |
| 1     | `package.json`, `pnpm-lock.yaml`, `.npmrc`, `svelte.config.js` (initial), `vite.config.js`                          |
| 2     | `svelte.config.js` (final), `.env.example`, `jsconfig.json`, `src/lib/types.js`                                     |
| 3     | `src/app.css`, `src/app.html`, `src/lib/components/ui/**`, `src/routes/+layout.svelte` (initial)                    |
| 4     | `src/lib/server/{redis,orders,sepay}.js`                                                                            |
| 5     | `src/routes/api/**`                                                                                                 |
| 6     | `src/routes/pay/+page.{svelte,server.js}`                                                                           |
| 7     | `src/lib/components/Pay{Form,Awaiting,Paid}.svelte`, `src/routes/+page.svelte`, `src/routes/+layout.svelte` (final) |
| 8     | `README.md`, `.gitignore`                                                                                           |

## Test matrix (manual smoke for demo — no test framework added)

| #   | Scenario                  | Steps                                                                | Expected                                                                                |
| --- | ------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 1   | Landing renders           | `pnpm dev` → open `/`                                                | Header + intro + "Open /pay" button                                                     |
| 2   | Form validation           | `/pay`, submit empty/0/non-numeric                                   | Inline error, no redirect                                                               |
| 3   | Order creation            | `/pay`, amount 10000, submit                                         | Redirects to `/pay?code=SE...`, shows awaiting state, QR image loads from `qr.sepay.vn` |
| 4   | Redis state               | `redis-cli` (or Upstash console) `GET order:<code>`                  | JSON with `status:"pending"`                                                            |
| 5   | Polling                   | Leave awaiting tab open                                              | Network panel shows `GET /api/orders/<code>` every 2s                                   |
| 6   | Dev simulator path        | `curl -X POST /api/dev/simulate-webhook -d '{"code":"<code>"}'`      | Returns 200; awaiting tab flips to paid within 2s                                       |
| 7   | Webhook auth              | `curl -X POST /api/webhooks/sepay -d '{}'` (no header)               | 401                                                                                     |
| 8   | Webhook dedup             | Replay same payload (same `id`) twice                                | Both return 200; order updated once                                                     |
| 9   | Webhook unmatched         | Send payload with `code:null`, content with no prefix match          | 200 `{unmatched:true}`; no order touched                                                |
| 10  | Outgoing transfer ignored | `transferType:"out"` payload                                         | 200; no order touched                                                                   |
| 11  | Prod guard                | `pnpm build && pnpm preview`, hit `/api/dev/simulate-webhook`        | 404                                                                                     |
| 12  | Dark mode                 | Toggle via mode-watcher / OS                                         | Tokens swap; contrast preserved                                                         |
| 13  | Reduced motion            | OS setting → reduce                                                  | No fade transitions on state swap                                                       |
| 14  | Real webhook (ngrok)      | `ngrok http 5173`, set SePay dashboard URL, do 10k VND test transfer | Awaiting → paid in <5s                                                                  |

## Open questions

- Confirm `SEPAY_ORDER_PREFIX` value — `SEVQR` (VietinBank-safe) or shorter? Plan uses env default `SEVQR`.
- Real bank account for ngrok test (test 14) — needs user-provided creds.
- Should expiry (15min) be enforced server-side (reject webhook after) or UI-only? Plan = UI-only for demo.

---

## Exact command summary (copy-paste sequence)

```bash
# Phase 1
pnpm dlx sv@latest create . --no-types --template minimal --add tailwindcss --add prettier --install pnpm
pnpm add -D @sveltejs/adapter-vercel@^5
pnpm remove @sveltejs/adapter-auto

# Phase 3
pnpm dlx shadcn-svelte@latest init
pnpm dlx shadcn-svelte@latest add button input label card badge alert skeleton sonner alert-dialog
pnpm add mode-watcher lucide-svelte

# Phase 4
pnpm add @upstash/redis nanoid

# Phase 8
pnpm build && pnpm preview
```

Sources verified during planning:

- [sv create — Svelte CLI Docs](https://svelte.dev/docs/cli/sv-create)
- [shadcn-svelte SvelteKit install](https://www.shadcn-svelte.com/docs/installation/sveltekit)
- [shadcn-svelte Tailwind v4 migration](https://www.shadcn-svelte.com/docs/migration/tailwind-v4)
- [shadcn-svelte Svelte 5 migration](https://www.shadcn-svelte.com/docs/migration/svelte-5)
