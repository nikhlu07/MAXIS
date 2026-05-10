# MAXIS — Anchor program (`maxis`)

On-chain checkout **metadata** plus **USDC escrow settlement**: a PDA-seeded **`CheckoutCommit`** account and an **associated token vault** owned by that PDA. Settlement uses SPL **`transfer_checked`** CPIs — explorer-verifiable Frontier-style demos.

Direct **wallet → merchant** USDC is still valid for the API’s legacy `402.recipient` path; the escrow path is the **stronger** settlement story.

## Program ID (devnet template)

```
8xnqY7BbiFDaSKtYjgreQdgNjvvh9nteNs5azqPg6DTX
```

## Prerequisites

- [Rust](https://rustup.rs/) + Solana toolchain (`cargo-build-sbpf`)
- [Anchor](https://www.anchor-lang.com/docs/installation) **0.30.x**

## Build

```bash
cd maxis-anchor
chmod +x scripts/prep-program-keypair.sh
./scripts/prep-program-keypair.sh
anchor build
```

Artifacts: `target/deploy/maxis.so` (+ IDL under `target/idl/`).

`cargo check -p maxis` works from this directory if you only have the Rust toolchain (no Anchor CLI).

## Deploy (devnet)

```bash
solana config set --url devnet
# Fund deployer wallet with SOL first
anchor deploy --provider.cluster devnet
```

Deploying **this** revision changes the **`CheckoutCommit` layout** versus older builds (`depositor`, `usdc_mint`, `released`, `refunded`, …). Prefer a **fresh program id / clean cluster state** when upgrading from the audit-only program.

## Accounts & PDAs

- **Checkout PDA** seeds: `["checkout", order_id_hash]` where `order_id_hash` is **`sha256(utf8(orderId))`** — 32 bytes (full digest).

- **Escrow vault** (USDC ATA): SPL **associated token address** with **mint = USDC**, **owner = checkout PDA** (use **owner off-curve** when deriving ATA in JS).

## Instructions

| Instruction                      | Who signs          | Purpose |
|----------------------------------|--------------------|---------|
| `commit_checkout`                | payer (buyer/demo) | Init `CheckoutCommit` + empty **vault ATA**; records `merchant`, **`depositor` = payer**, mint, hashes, micro-USDC amount |
| `release_escrow_to_merchant`   | merchant           | CPI `transfer_checked` **vault → merchant USDC ATA** for exactly `amount_micro_usdc` |
| `refund_escrow_to_depositor`     | depositor          | CPI `transfer_checked` **full vault balance → depositor USDC ATA** (before release; sets `refunded`) |
| `mark_paid`                      | merchant           | Sets `paid = true` only (audit / legacy demo; **no** token CPI) |

### Hash convention (clients)

Use **`sha256`** of UTF-8 strings (32-byte digest):

- `order_id_hash`: first 32 bytes of `sha256(orderIdUtf8)`
- `payment_request_id_hash`: same for the `paymentRequestId` string from HTTP `402`.

## Typical settlement flow

1. **`commit_checkout`** — creates state + vault; payer pays SOL rent.
2. **SPL transaction (wallet)** — transfer USDC from buyer ATA to **vault ATA** (`>= amount_micro_usdc`).
3. **`release_escrow_to_merchant`** — merchant receives USDC on-chain (`released`, `paid`), or **`refund_escrow_to_depositor`** to unwind.

Optional: **`mark_paid`** for off-chain-paid / explanatory demos without moving vault funds.

USDC decimals are **6** (`SPL_USDC_DECIMALS` in `lib.rs`).

## API alignment

[`maxis-api`](../maxis-api) includes `anchor.programId` and **`anchor.settlement`** in the HTTP **402** body (`checkoutPda`, `escrowVaultAta`, mint ids) so agents can compose transactions deterministically alongside `commitCheckout` hashes.
