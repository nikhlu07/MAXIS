# M.A.X.I.S.

MAXIS is a local-commerce workflow layer for AI assistants and agents.

It provides structured merchant catalogs, deterministic order APIs, and x402 checkout on Solana so agents can complete real-world transactions end to end.

## One-line pitch

**MAXIS makes local businesses AI-orderable and machine-payable via structured commerce APIs + x402 on Solana.**

## What this repository contains

- Product direction and hackathon scope (this `README.md`)
- Frontend app and UI docs in `maxis-frontend/`

## Problem

AI assistants can reason, but most local businesses are still not machine-readable:

- Menus/services are unstructured
- Checkout paths are built for humans, not agents
- Agents fail on reliability and payment completion

## Solution

MAXIS exposes one agent-friendly flow:

1. `GET catalog`
2. `POST order`
3. `POST checkout` -> returns `402 Payment Required`
4. Agent pays USDC on Solana
5. Payment verification updates order state for merchant fulfillment

## MVP scope (hackathon)

### In scope

- Merchant dashboard: catalog management + orders view
- Agent-facing APIs for catalog/order/status
- x402 payment challenge and Solana USDC verification
- Pickup-first fulfillment flow (`AWAITING_PAYMENT -> PAID -> ACCEPTED -> READY`)

### Out of scope

- Delivery partner network
- Fully automated plugin ingestion across every CMS
- Broad enterprise integrations

## Why this is different

Stripe validates machine payments with x402.

MAXIS applies the same payment handshake to **local commerce workflows**: discovery, ordering, and fulfillment status for physical-world merchants.

## Pricing (pilot)

- `$29/month` + `$0.15` per successful order
- No charge for failed/cancelled orders
- Marked as pilot pricing (subject to validation)

## Reference API surface

- `GET /merchants/:slug/catalog`
- `POST /orders`
- `POST /orders/checkout` (returns HTTP `402`)
- `POST /orders/:id/pay`
- `GET /orders/:id/status`

## High-level architecture

```text
User -> AI Assistant/Agent -> MAXIS API -> Solana (USDC verification)
                                 |
                                 -> Merchant Dashboard (orders/status)
```

## Frontend

Frontend implementation and setup live in:

- `maxis-frontend/README.md`

## Hackathon positioning

- Local business wedge for clear demo and tight execution
- End-to-end proof: discover -> order -> 402 -> paid -> ready
- Solana-native settlement for machine payments

## References

- [x402](https://www.x402.org/)
- [Solana](https://solana.com)
- [Colosseum Frontier](https://colosseum.com/frontier)
