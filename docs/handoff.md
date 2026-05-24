# Handoff — pause point

**Status:** bootstrap paused after design approval gate. Planning + implementation deferred to next session.

## What was decided (locked)

### Stack (see `docs/tech-stack.md`)
- SvelteKit 2 + Svelte 5 (runes) + **JavaScript** (JSDoc for typedefs)
- **pnpm** (lockfile committed; `packageManager` field)
- Tailwind v4 + **shadcn-svelte** (button, input, label, card, badge, alert) + `lucide-svelte` + `mode-watcher`
- `@upstash/redis` via `Redis.fromEnv()`
- `@sveltejs/adapter-vercel`
- Node.js runtime for all server routes
- **Dev helper included:** `POST /api/dev/simulate-webhook` gated by `!import.meta.env.PROD`

### Design (see `docs/design-guidelines.md` + `docs/wireframe/*.html`)
- Technical-minimal style, indigo accent (`#4F46E5` light / `#6366F1` dark)
- Inter (UI) + JetBrains Mono (codes/amounts)
- 4px radius, 4-base spacing, 150ms fade transitions, reduced-motion safe
- Three states on `/pay` (form / awaiting / paid), same route
- Mobile-first, single column
- **NOT YET APPROVED BY USER** — design gate was deferred. Re-ask on resume.

### Research (see `docs/research-*.md`)
- `research-sepay.md` — VietQR endpoint, webhook payload, auth header, order-code extraction, idempotency on `id`
- `research-upstash.md` — `@upstash/redis` patterns, `nx:true` for dedup, Vercel marketplace integration
- `research-vercel.md` — Node runtime for webhook, env var setup, ngrok for local

## What's left

1. **Re-ask design gate** (was deferred, not approved).
2. **Run `/ck:plan --auto`** with full requirements — see `docs/tech-stack.md` + design guidelines as inputs. Plan dir → `./plans/<name>/`.
3. **Run `/ck:cook --auto <plan-path>`** to scaffold + implement.
4. **Onboarding**: walk user through env vars (`.env.example` → `.env.local`), `pnpm install`, `pnpm dev`, ngrok setup, SePay dashboard webhook URL config, `vercel deploy`.
5. **Final report** + commit gate.
6. **Run `/ck:journal`** for the session record.

## Open questions to confirm on resume

- Design approval gate (style direction, accent color).
- Any further stack tweaks (currently locked: shadcn-svelte over Skeleton/plain).

## Files created this session

```
docs/
├── tech-stack.md
├── design-guidelines.md
├── handoff.md                  ← this file
├── research-sepay.md
├── research-upstash.md
├── research-vercel.md
└── wireframe/
    ├── home.html
    ├── pay-form.html
    ├── pay-awaiting.html
    └── pay-paid.html
plans/                          ← empty, planning not run yet
```

No code written. No `package.json`, no source files. Pure docs.

## Resume command (suggested)

```
/ck:bootstrap --auto resume from docs/handoff.md
```

Or just: "continue the SePay bootstrap, design is approved" → I'll run `/ck:plan --auto` → `/ck:cook --auto`.
