# MAXIS API

Backend service for the MAXIS end-to-end demo flow:

`catalog -> order -> 402 checkout -> pay -> status -> merchant ready`

## Run

**Stack:** TypeScript (`src/`), strict `tsc` build to `dist/`, dev server via `tsx`.

```bash
npm install
npm run dev          # watch + run src/server.ts (hot restart on save)
```

Production / Docker-style:

```bash
npm run build        # emits dist/
npm start            # node dist/server.js
```

```bash
npm run typecheck    # tsc --noEmit
```

Server default: `http://localhost:3001`

Copy [.env.example](.env.example) to `.env` if you use env-based config.

**Optional smoke test:** with the server running, `./scripts/verify-maxis-demo.sh` (requires `curl` and `jq`). No RPC URL is required (payload-only pay path).

## On-chain payment verification (Helius / any Solana RPC)

When **`SOLANA_RPC_URL`** or **`HELIUS_RPC_URL`** is set, `POST /orders/:id/pay` calls `getParsedTransaction` and requires a **succeeded** transaction that **credits the merchant’s USDC associated token account** by at least the order total (devnet USDC mint by default).

Set **`ONCHAIN_PAY_VERIFY=false`** to force the legacy payload-only check (e.g. when an RPC URL is present but you are still testing with fake signatures).

`GET /health` returns `{ "onchainPayVerify": true|false }`.

## Demo credentials

- Merchant slug: `north-star-cafe`
- Login: `demo@maxis.local` / `demo123`
- Bearer token (demo): `demo-token`

## Endpoints

### Agent-facing

- `GET /health`
- `GET /merchants/:slug/catalog`
- `POST /orders`
- `POST /orders/checkout` (returns HTTP **`402`** JSON + `anchor` metadata: program id + SHA-256 hex for `commit_checkout` — see [`../maxis-anchor/README.md`](../maxis-anchor/README.md))
- `POST /orders/:id/pay`
- `GET /orders/:id/status`

### Merchant-facing

- `POST /auth/register`
- `POST /auth/login`
- `GET /dashboard/orders` (requires `Authorization: Bearer demo-token`)
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
