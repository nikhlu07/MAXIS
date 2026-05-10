# MAXIS — Anchor program (`maxis`)

On-chain **`commit_checkout`** account: stores **merchant**, **SHA-256-ish sized hashes** of `orderId` / `paymentRequestId`, **USDC amount** (micro units, 6 decimals), and **`mark_paid`** for merchant-signed audit.

This does **not** replace SPL USDC transfers — wallets still settle USDC via the Token program. The program adds a **explorer-visible contract** Frontier judges can open on SolanaFM / Solscan.

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

## Deploy (devnet)

```bash
solana config set --url devnet
# Fund deployer wallet with SOL first
anchor deploy --provider.cluster devnet
```

## Instructions

| Instruction        | Who signs      | Purpose |
|--------------------|----------------|---------|
| `commit_checkout`  | payer (fee)    | Creates PDA seeded by `sha256`/32-byte slice of stable order id (`["checkout", order_id_hash]`). Stores merchant pubkey + amount micro USDC + `payment_request_id` hash |
| `mark_paid`        | merchant wallet| Sets `paid = true` — optional demo reconciliation flag |

### Hash convention (clients)

Use **`sha256`** of UTF-8 strings (first 32 bytes of digest, or truncate/pad deterministically):

- `order_id_hash`: `crypto.createHash("sha256").update(orderId, "utf8").digest()`
- Same for **`payment_request_id_hash`** against the `paymentRequestId` string from HTTP 402.

## API alignment

[`maxis-api`](../maxis-api) may include this program id inside the **402 JSON** (`anchor.programId`) so agents know which program to compose with settlements.
