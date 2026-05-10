# MAXIS API

Backend service for the MAXIS end-to-end demo flow:

`catalog -> order -> 402 checkout -> pay -> status -> merchant ready`

## Run

**Stack:** TypeScript (`src/`), PostgreSQL via **Prisma**, strict `tsc` build to `dist/`, dev server via `tsx`.

### Database (Supabase)

1. Copy [.env.example](.env.example) → `.env`.
2. In Supabase: **Project → Connect**, copy **`DATABASE_URL`** (transaction pooler, `:6543`, `pgbouncer=true`) and **`DIRECT_URL`** (session pooler, `:5432`) — same names Prisma expects.
3. Replace the database password in **both** lines.

```bash
npm run db:setup    # prisma db push + seed (demo merchant + catalog)
```

For a one-off: `npm run db:push` then `npm run db:seed`.

**`P1000` authentication failed:** the password in `.env` must be your **database** password from Supabase (Database settings — not API keys). Placeholders like `YOUR_DB_PASSWORD` will always fail—paste the real value. Encode special chars in the URL. If pooler `:5432` still fails for `db push`, set **`DIRECT_URL`** to the **direct** host from Connect: `postgresql://postgres:PASSWORD@db.<PROJECT_REF>.supabase.co:5432/postgres` (requires IPv6 or IPv4 add-on per Supabase).

```bash
npm install
npm run dev          # watch + run src/server.ts (hot restart on save)
```

Production-style run:

```bash
npm run build        # prisma generate + emits dist/
npm start            # node dist/server.js
```

```bash
npm run typecheck    # prisma generate + tsc --noEmit
```

Server default: `http://localhost:3001`

Copy [.env.example](.env.example) to `.env` and set **`DATABASE_URL`**, **`DIRECT_URL`**, **`JWT_SECRET`**, and optional RPC vars.

**API smoke test** (Node `fetch`, no bash): API running + DB seeded — `npm run verify:demo` (alias: `npm run test:api`). Optional: `API_BASE_URL=https://your-api npm run verify:demo`. No RPC URL is required (payload-only pay path).

## On-chain payment verification (Helius / any Solana RPC)

When **`SOLANA_RPC_URL`** or **`HELIUS_RPC_URL`** is set, `POST /orders/:id/pay` calls `getParsedTransaction` and requires a **succeeded** transaction that **credits the merchant’s USDC associated token account** by at least the order total (devnet USDC mint by default).

Set **`ONCHAIN_PAY_VERIFY=false`** to force the legacy payload-only check (e.g. when an RPC URL is present but you are still testing with fake signatures).

`GET /health` returns `{ "onchainPayVerify": true|false }`.

## Demo credentials

After **`npm run db:seed`**:

- Merchant slug: `north-star-cafe`
- Login: `demo@maxis.local` / `demo123`

Use **`POST /auth/login`** (or register) — the JSON **`token`** is a JWT. Send dashboard requests as **`Authorization: Bearer <token>`**.

## Endpoints

### Agent-facing

- `GET /health`
- `GET /merchants/:slug/catalog`
- `POST /orders`
- `POST /orders/checkout` (returns HTTP **`402`** JSON + `anchor` metadata: program id + `commit_checkout` hashes + **`anchor.settlement`** escrow PDA / vault ATA — see [`../maxis-anchor/README.md`](../maxis-anchor/README.md))
- `POST /orders/:id/pay`
- `GET /orders/:id/status`

### Merchant-facing

- `POST /auth/register`
- `POST /auth/login`
- `GET /dashboard/orders` (requires `Authorization: Bearer <JWT from /auth/login>`)
- `PATCH /dashboard/orders/:id/status` (`ACCEPTED`, `READY`, `CANCELLED`)
- `POST /dashboard/catalog`

## Sample flow

```bash
# 1) Create order
curl -X POST http://localhost:3001/orders \
  -H "Content-Type: application/json" \
  -d '{
    "merchantSlug":"north-star-cafe",
    "items":[{"itemId":"item_latte_sm","qty":2}]
  }'

# 2) Checkout (402)
curl -X POST http://localhost:3001/orders/checkout \
  -H "Content-Type: application/json" \
  -d '{"orderId":"ord_..."}'

# 3) Submit payment proof
# Use `paymentRequestId` + `amount` (+ optional `idempotencyKey`) from the 402 body.
curl -X POST http://localhost:3001/orders/ord_.../pay \
  -H "Content-Type: application/json" \
  -d '{
    "paymentRequestId":"pr_...",
    "txSignature":"demo_tx_signature_1234567890",
    "amount":"9.00",
    "recipient":"CkkwHhMz3tiRcrdLGBRxLvaHchZqTUEFxNLxUcMzYdRZ",
    "asset":"USDC",
    "chain":"solana-devnet",
    "reference":"ord_...",
    "idempotencyKey":"idem_retry_safe_001"
  }'
```
