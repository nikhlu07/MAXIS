/**
 * Verifies a Solana transaction credited the merchant's USDC ATA by at least `expectedUsd`.
 * Works with any JSON-RPC endpoint (Helius, QuickNode, public devnet, etc.).
 */
import {
  Connection,
  type ParsedMessage,
  type ParsedTransactionWithMeta,
  PublicKey,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";

type TokenBal = NonNullable<NonNullable<ParsedTransactionWithMeta["meta"]>["postTokenBalances"]>[number];

function accountKeysFromParsedMessage(msg: ParsedMessage): string[] {
  return msg.accountKeys.map((k): string => {
    if (typeof k === "string") return k;
    if (k instanceof PublicKey) return k.toBase58();
    if (k && typeof k === "object" && "pubkey" in k) {
      return (k as { pubkey: PublicKey }).pubkey.toBase58();
    }
    return String(k);
  });
}

export type VerifyUsdcParams = {
  rpcUrl: string;
  signature: string;
  /** Merchant main wallet (owner of USDC ATA). */
  merchantWalletBase58: string;
  usdcMintBase58: string;
  expectedUsd: number;
};

export type VerifyUsdcResult =
  | { ok: true }
  | { ok: false; code: string; message: string };

export async function verifyUsdcPaymentToMerchant(opts: VerifyUsdcParams): Promise<VerifyUsdcResult> {
  const { rpcUrl, signature, merchantWalletBase58, usdcMintBase58, expectedUsd } = opts;

  let merchantOwner: PublicKey;
  let mintPk: PublicKey;
  let destAta: PublicKey;
  try {
    merchantOwner = new PublicKey(merchantWalletBase58);
    mintPk = new PublicKey(usdcMintBase58);
    destAta = getAssociatedTokenAddressSync(mintPk, merchantOwner, false, TOKEN_PROGRAM_ID);
  } catch (e) {
    return {
      ok: false,
      code: "invalid_pubkey",
      message: e instanceof Error ? e.message : String(e),
    };
  }

  const destAtaStr = destAta.toBase58();
  const expectedRaw = BigInt(Math.round(Number(expectedUsd) * 1e6));
  if (expectedRaw <= 0n) {
    return { ok: false, code: "invalid_expected_amount", message: "expectedUsd must be positive" };
  }

  const connection = new Connection(rpcUrl, "confirmed");
  let parsed: ParsedTransactionWithMeta | null;
  try {
    parsed = await connection.getParsedTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
  } catch (e) {
    return {
      ok: false,
      code: "rpc_error",
      message: e instanceof Error ? e.message : String(e),
    };
  }

  if (!parsed) {
    return {
      ok: false,
      code: "tx_not_found",
      message: "Transaction not found yet or invalid signature.",
    };
  }

  if (parsed.meta?.err) {
    return {
      ok: false,
      code: "tx_failed",
      message: typeof parsed.meta.err === "object" ? JSON.stringify(parsed.meta.err) : String(parsed.meta.err),
    };
  }

  const accountKeys = accountKeysFromParsedMessage(parsed.transaction.message);
  const ataIndex = accountKeys.indexOf(destAtaStr);
  if (ataIndex === -1) {
    return {
      ok: false,
      code: "merchant_ata_not_in_tx",
      message: `Expected USDC ATA ${destAtaStr} not present in transaction accounts.`,
    };
  }

  function amountAtIndex(balances: readonly TokenBal[] | null | undefined, index: number): bigint {
    const row = (balances ?? []).find(
      (b: TokenBal) =>
        b.accountIndex === index && b.mint === usdcMintBase58 && typeof b.uiTokenAmount?.amount === "string",
    );
    if (!row) return 0n;
    try {
      return BigInt(row.uiTokenAmount.amount);
    } catch {
      return 0n;
    }
  }

  const preAmt = amountAtIndex(parsed.meta?.preTokenBalances, ataIndex);
  const postAmt = amountAtIndex(parsed.meta?.postTokenBalances, ataIndex);
  const delta = postAmt - preAmt;

  if (delta < expectedRaw) {
    return {
      ok: false,
      code: "usdc_amount_mismatch",
      message: `Expected at least ${expectedRaw} raw USDC credits to merchant ATA; got delta ${delta}.`,
    };
  }

  return { ok: true };
}
