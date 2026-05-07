# MAXIS API

Backend service for the MAXIS end-to-end demo flow:

`catalog -> order -> 402 checkout -> pay -> status -> merchant ready`

## Run

```bash
npm install
npm run dev
```

Server default: `http://localhost:3001`

## Demo credentials

- Merchant slug: `north-star-cafe`
- Login: `demo@maxis.local` / `demo123`
- Bearer token (demo): `demo-token`

## Endpoints

### Agent-facing

- `GET /health`
- `GET /merchants/:slug/catalog`
- `POST /orders`
- `POST /orders/checkout` (returns HTTP `402`)
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
curl -X POST http://localhost:3001/orders/ord_.../pay \
  -H "Content-Type: application/json" \
  -d '{
    "txSignature":"demo_tx_signature_1234567890",
    "amountUsd":9,
    "recipientWallet":"8H1payoutWalletDemoSolanaAddress",
    "asset":"USDC",
    "chain":"solana-devnet",
    "reference":"ord_..."
  }'
```
