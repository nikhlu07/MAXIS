# M.A.X.I.S. frontend

Frontend for MAXIS: a local commerce workflow layer where AI assistants/agents can discover, order, and pay via x402 on Solana.

This app includes:
- Marketing + developer pages
- Merchant dashboard shell
- UX language aligned to the MVP flow: `catalog -> order -> 402 -> paid -> ready`

## Product Positioning

MAXIS is not just payment rails. It combines:
- Agent-readable commerce endpoints
- Order lifecycle management for merchants
- x402 checkout with USDC settlement on Solana

Pitch line:
> Stripe validated x402 for machine payments. MAXIS applies that pattern to local commerce workflows.

## MVP Scope

- Pickup-first flow (no delivery network in v1)
- Merchant listing/catalog management
- Order status progression:
  - `AWAITING_PAYMENT`
  - `PAID`
  - `ACCEPTED`
  - `READY`
- Payment challenge via HTTP `402 Payment Required`

## Docs

Detailed frontend requirements and UX contracts: **[FRONTEND-SPEC.md](./FRONTEND-SPEC.md)**

## Setup

```bash
cp .env.local.example .env.local   # optional
npm install
npm run dev
```

Open the URL printed by the dev server.

## Build

```bash
npm run build
npm run preview
```

## Deployment (Vercel)

This project uses [Nitro](https://nitro.build/) with the `vercel` preset and outputs to `.vercel/output`.

Recommended Vercel settings:
- Root directory: `maxis-frontend` (if monorepo)
- Install command: `npm install` (or `npm ci`)
- Build command: `npm run build`
- Output directory: leave empty

Note: `wrangler.jsonc` is only for optional Cloudflare deployment, not required for Vercel.
