# PICKAPP MVP

Social commerce copilot for women entrepreneurs: store, AI product sheets, public catalog, sales assistant grounded in real inventory, orders with transactional reservations, LIVE sessions, dashboard analytics, and n8n automation hooks.

## Stack

- Next.js 16 App Router + React 19 + TypeScript + Tailwind CSS 4
- Supabase PostgreSQL/Storage/RLS/RPC migrations (`supabase/migrations`)
- Clerk auth with demo cookie fallback for credential-free runs
- n8n exportable workflows in `n8n/workflows`
- LLM product drafts and assistant via OpenAI-compatible API or n8n webhook

## Quick start (demo mode)

No credentials required:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`, enter as **Emprendedora** or **Cliente**. Demo mode uses an in-memory seeded store `Casa Nova` at `/store/casa-nova`.

Demo credentials are not real accounts; `PICKAPP_DEMO_SEED=false` starts empty.

## Production-like mode

1. Copy `.env.example` to `.env.local`.
2. Set `PICKAPP_DATA_MODE=supabase`, `PICKAPP_AUTH_MODE=clerk`, Supabase keys and Clerk keys.
3. Apply `supabase/migrations/20251121000000_init.sql` to Supabase SQL editor or CLI.
4. Create Storage bucket `product-images` (public read is enough for MVP images).
5. Set `PICKAPP_LLM_API_KEY` plus `PICKAPP_LLM_BASE_URL`/`PICKAPP_LLM_MODEL` for AI routes. Verified free OpenRouter vision model: `nvidia/nemotron-3.5-super-vl:free` with `PICKAPP_LLM_BASE_URL=https://openrouter.ai/api/v1`.
6. `npm run build && npm start`.

## Architecture

- `src/lib/data/*`: provider interface with `demo` and `supabase` implementations. The frontend never sends trusted `business_id`; server resolves ownership.
- `src/lib/ai.ts`: LLM/n8n calls for product drafts and assistant replies with strict JSON validation.
- `src/lib/conversations.ts`: persists assistant conversations/messages.
- `src/app/api/*`: protected endpoints for products, inventory, orders, live, analytics, assistant, upload.
- Public pages: `/`, `/stores`, `/store/[slug]`, `/store/[slug]/product/[id]`, `/live/[id]`.
- Entrepreneur panel: `/dashboard`, `/onboarding`.

## n8n

Import JSON files from `n8n/workflows` into n8n, set `PICKAPP_APP_URL` and `N8N_WEBHOOK_SECRET` where used, and point webhooks to the app API. See `docs/n8n.md`.

## Tests

```bash
npm test
npm run build
```

Critical coverage: validation, idempotent orders, inventory reservation/confirmation, tenant isolation helpers, and dashboard pending-vs-confirmed metrics.

## Not implemented yet / pending

- Real payment provider (orders stop at confirmed/manual states).
- Clerk auth is implemented; demo auth remains for credential-free local runs.
- Supabase Realtime subscription UI for LIVE is polling-based in MVP; schema/RPC supports realtime.
- Avalanche Fuji is prepared as verifiable SHA-256 order receipts at `GET /api/orders/[id]/receipt` with no personal data; on-chain anchoring is still pending Fuji credentials.
