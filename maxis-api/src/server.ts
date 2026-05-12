import { createHash, randomUUID } from "node:crypto";
import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import { z } from "zod/v3";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { OrderStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { verifyUsdcPaymentToMerchant } from "./solana-verify.js";
import { prisma } from "./prisma.js";
import {
  hashPassword,
  signMerchantToken,
  verifyMerchantToken,
  verifyPassword,
} from "./auth-lib.js";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT || 3001);

const USDC_MINT_DEVNET = process.env.USDC_MINT_DEVNET ?? "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
const SOLANA_RPC_URL = (process.env.SOLANA_RPC_URL || process.env.HELIUS_RPC_URL || "").trim();
const ONCHAIN_PAY_VERIFY = process.env.ONCHAIN_PAY_VERIFY !== "false" && SOLANA_RPC_URL.length > 0;
const CHECKOUT_TTL_MS = Number(process.env.CHECKOUT_TTL_MS || 10 * 60 * 1000);
/** Matches `declare_id!` in `maxis-anchor/programs/maxis` (override after your own deploy). */
const MAXIS_ANCHOR_PROGRAM_ID =
  process.env.MAXIS_ANCHOR_PROGRAM_ID ?? "8xnqY7BbiFDaSKtYjgreQdgNjvvh9nteNs5azqPg6DTX";

function sha256Utf8Digest32(s: string): Buffer {
  return createHash("sha256").update(s, "utf8").digest();
}

function sha256HexUtf8(s: string): string {
  return sha256Utf8Digest32(s).toString("hex");
}

/** PDA + USDC escrow vault ATA (matches `commit_checkout` in `maxis-anchor`). Checkout PDA is off-curve; ATA uses `allowOwnerOffCurve`. */
function settlementAddressesForOrder(orderId: string): { checkoutPda: string; escrowVaultAta: string } {
  const programPk = new PublicKey(MAXIS_ANCHOR_PROGRAM_ID);
  const mintPk = new PublicKey(USDC_MINT_DEVNET);
  const digest = sha256Utf8Digest32(orderId);
  const [checkoutPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("checkout"), digest],
    programPk,
  );
  const escrowVaultAta = getAssociatedTokenAddressSync(mintPk, checkoutPda, true);
  return {
    checkoutPda: checkoutPda.toBase58(),
    escrowVaultAta: escrowVaultAta.toBase58(),
  };
}

const createOrderSchema = z.object({
  merchantSlug: z.string().min(1),
  items: z.array(z.object({ itemId: z.string().min(1), qty: z.number().int().positive() })).min(1),
  fulfillment: z
    .object({
      type: z.literal("pickup"),
      pickupAt: z.string().optional(),
    })
    .optional(),
});

const checkoutSchema = z.object({
  orderId: z.string().min(1),
});

const paySchema = z
  .object({
    paymentRequestId: z.string().min(1),
    idempotencyKey: z.string().min(8).max(128).optional(),
    txSignature: z.string().min(10),
    amount: z.union([z.string(), z.number()]).optional(),
    amountUsd: z.number().positive().optional(),
    recipient: z.string().min(8).optional(),
    recipientWallet: z.string().min(8).optional(),
    asset: z.literal("USDC"),
    chain: z.literal("solana-devnet"),
    reference: z.string().min(1),
  })
  .superRefine((data, ctx) => {
    const hasAmount = data.amount !== undefined || data.amountUsd !== undefined;
    if (!hasAmount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide `amount` (string recommended) or `amountUsd` (number)",
        path: ["amount"],
      });
    }
    if (!data.recipient && !data.recipientWallet) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide `recipient` or `recipientWallet`",
        path: ["recipient"],
      });
    }
  });

const updateStatusSchema = z.object({
  status: z.enum([OrderStatus.ACCEPTED, OrderStatus.READY, OrderStatus.CANCELLED]),
});

function roundUsd(value: number): number {
  return Math.round(value * 100) / 100;
}

function decToNum(v: Prisma.Decimal | null | undefined): number {
  if (v == null) return 0;
  return v.toNumber();
}

function parseAmountToNumber(amount: unknown, amountUsd: number | undefined): number {
  if (amountUsd != null) return roundUsd(amountUsd);
  if (typeof amount === "number") return roundUsd(amount);
  const n = Number(String(amount).trim());
  if (!Number.isFinite(n)) throw new Error("invalid_amount_format");
  return roundUsd(n);
}

function normalizeRecipient(parsed: z.infer<typeof paySchema>): string {
  return parsed.recipient ?? parsed.recipientWallet ?? "";
}

const solanaPayoutAddressSchema = z
  .string()
  .trim()
  .min(32)
  .max(44)
  .superRefine((s, ctx) => {
    try {
      // eslint-disable-next-line no-new
      new PublicKey(s);
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "invalid_solana_address" });
    }
  });

function idempotencyCacheKey(orderId: string, idempotencyKey: string): string {
  return `pay:${orderId}:${idempotencyKey}`;
}

class ApiError extends Error {
  constructor(
    public status: number,
    public error: string,
    public details?: unknown,
  ) {
    super(error);
    this.name = "ApiError";
  }
}

function fail(status: number, error: string, details?: unknown): never {
  throw new ApiError(status, error, details);
}

function zodBody<T extends z.ZodType>(schema: T, body: unknown): z.infer<T> {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    fail(400, "invalid_payload", { validation: parsed.error.flatten() });
  }
  return parsed.data;
}

function toPublicCatalogItem(item: { id: string; name: string; priceUsd: Prisma.Decimal; available: boolean }) {
  return {
    id: item.id,
    name: item.name,
    usd: decToNum(item.priceUsd),
    available: item.available,
  };
}

function authRequired(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization ?? "";
  if (!auth.startsWith("Bearer ")) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const token = auth.slice(7);
  try {
    req.merchant = verifyMerchantToken(token);
    next();
  } catch {
    res.status(401).json({ error: "unauthorized" });
  }
}

/** Express 5 may type `req.params` values as `string | string[]`. */
function routeParam(v: string | string[] | undefined): string {
  if (v == null) return "";
  return Array.isArray(v) ? (v[0] ?? "") : v;
}

type OrderWithLines = Prisma.OrderGetPayload<{ include: { lines: true } }>;

function paymentJson(order: OrderWithLines) {
  if (!order.txSignature || !order.paidAt) return null;
  return {
    paymentRequestId: order.lastPaymentRequestId ?? order.activePaymentRequestId ?? "",
    txSignature: order.txSignature,
    amount: order.paymentAmountDisplay ?? decToNum(order.paymentUsd).toFixed(2),
    amountUsd: order.paymentUsd != null ? decToNum(order.paymentUsd) : 0,
    paidAt: order.paidAt.toISOString(),
    asset: "USDC" as const,
    chain: "solana-devnet" as const,
    mint: order.paymentMint ?? USDC_MINT_DEVNET,
    verifiedOnChain: order.verifiedOnChain,
  };
}

app.get("/", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    service: "maxis-api",
    message: "MAXIS API is running. Use GET /health to verify.",
    health: "/health",
  });
});

app.get("/health", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    service: "maxis-api",
    onchainPayVerify: ONCHAIN_PAY_VERIFY,
  });
});

app.post("/auth/register", async (req: Request, res: Response) => {
  const bodySchema = z.object({
    name: z.string().min(2),
    slug: z.string().min(2),
    city: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(6),
    payoutWallet: solanaPayoutAddressSchema,
  });

  const parsed = zodBody(bodySchema, req.body);
  const payoutNormalized = new PublicKey(parsed.payoutWallet.trim()).toBase58();
  const emailLower = parsed.email.toLowerCase();

  const conflict = await prisma.merchant.findFirst({
    where: { OR: [{ slug: parsed.slug }, { email: emailLower }] },
  });
  if (conflict) {
    res.status(409).json({ error: "merchant_exists" });
    return;
  }

  const passwordHash = await hashPassword(parsed.password);

  const merchant = await prisma.merchant.create({
    data: {
      name: parsed.name,
      slug: parsed.slug,
      city: parsed.city,
      email: emailLower,
      passwordHash,
      payoutWallet: payoutNormalized,
    },
  });

  const token = signMerchantToken({ sub: merchant.id, slug: merchant.slug });

  res.status(201).json({
    merchant: {
      id: merchant.id,
      name: merchant.name,
      slug: merchant.slug,
      city: merchant.city,
      payoutWallet: merchant.payoutWallet,
    },
    token,
  });
});

app.post("/auth/login", async (req: Request, res: Response) => {
  const bodySchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
  });
  const parsed = zodBody(bodySchema, req.body);

  const merchant = await prisma.merchant.findUnique({
    where: { email: parsed.email.toLowerCase() },
  });
  if (!merchant || !(await verifyPassword(parsed.password, merchant.passwordHash))) {
    res.status(401).json({ error: "invalid_credentials" });
    return;
  }

  const token = signMerchantToken({ sub: merchant.id, slug: merchant.slug });

  res.json({
    token,
    merchant: {
      id: merchant.id,
      slug: merchant.slug,
      name: merchant.name,
      city: merchant.city,
      payoutWallet: merchant.payoutWallet,
    },
  });
});

app.get("/merchants/:slug/catalog", async (req: Request, res: Response) => {
  const merchant = await prisma.merchant.findUnique({
    where: { slug: routeParam(req.params.slug) },
    include: { catalogItems: true },
  });
  if (!merchant) {
    res.status(404).json({ error: "merchant_not_found" });
    return;
  }

  const items = merchant.catalogItems.map((item) => toPublicCatalogItem(item));

  res.json({
    merchant: {
      slug: merchant.slug,
      name: merchant.name,
      city: merchant.city,
    },
    currency: "USD",
    items,
  });
});

app.post("/orders", async (req: Request, res: Response) => {
  const parsed = zodBody(createOrderSchema, req.body);

  const merchant = await prisma.merchant.findUnique({ where: { slug: parsed.merchantSlug } });
  if (!merchant) {
    res.status(404).json({ error: "merchant_not_found" });
    return;
  }

  const lineCreates: Prisma.OrderLineCreateWithoutOrderInput[] = [];
  let totalUsd = 0;

  for (const requestItem of parsed.items) {
    const item = await prisma.catalogItem.findFirst({
      where: { merchantId: merchant.id, id: requestItem.itemId, available: true },
    });
    if (!item) {
      res.status(400).json({ error: "item_unavailable", itemId: requestItem.itemId });
      return;
    }

    const lineTotal = roundUsd(decToNum(item.priceUsd) * requestItem.qty);
    lineCreates.push({
      catalogItemId: item.id,
      itemName: item.name,
      qty: requestItem.qty,
      unitPriceUsd: item.priceUsd,
      lineTotalUsd: lineTotal,
    });
    totalUsd += decToNum(item.priceUsd) * requestItem.qty;
  }

  const orderId = `ord_${randomUUID()}`;
  const fulfillment = (parsed.fulfillment ?? { type: "pickup" }) as Prisma.InputJsonValue;

  await prisma.order.create({
    data: {
      id: orderId,
      merchantId: merchant.id,
      merchantSlug: merchant.slug,
      totalUsd: roundUsd(totalUsd),
      status: OrderStatus.AWAITING_PAYMENT,
      fulfillment,
      lines: { create: lineCreates },
    },
  });

  res.status(201).json({
    orderId,
    status: OrderStatus.AWAITING_PAYMENT,
    totalUsd: roundUsd(totalUsd),
    currency: "USD",
    fulfillment: parsed.fulfillment ?? { type: "pickup" },
  });
});

app.post("/orders/checkout", async (req: Request, res: Response) => {
  const parsed = zodBody(checkoutSchema, req.body);

  const order = await prisma.order.findUnique({
    where: { id: parsed.orderId },
    include: { merchant: true },
  });
  if (!order) {
    res.status(404).json({ error: "order_not_found" });
    return;
  }
  if (order.status !== OrderStatus.AWAITING_PAYMENT) {
    res.status(409).json({ error: "order_not_payable", status: order.status });
    return;
  }

  const paymentRequestId = `pr_${randomUUID()}`;
  const checkoutExpiresAt = new Date(Date.now() + CHECKOUT_TTL_MS);

  await prisma.order.update({
    where: { id: order.id },
    data: {
      activePaymentRequestId: paymentRequestId,
      checkoutExpiresAt,
    },
  });

  const total = decToNum(order.totalUsd);
  const amt = total.toFixed(2);
  const amountMicroUsdc = String(BigInt(Math.round(total * 1e6)));
  const merchant = order.merchant;
  const settlement = settlementAddressesForOrder(order.id);

  res.status(402).json({
    error: "payment_required",
    orderId: order.id,
    paymentRequestId,
    amount: amt,
    amountUsd: total,
    currency: "USD",
    asset: "USDC",
    chain: "solana-devnet",
    mint: USDC_MINT_DEVNET,
    recipient: merchant.payoutWallet,
    recipientWallet: merchant.payoutWallet,
    reference: order.id,
    expiresAt: checkoutExpiresAt.toISOString(),
    verification: {
      requiredConfirmations: 1,
      commitment: "confirmed",
    },
    anchor: {
      programId: MAXIS_ANCHOR_PROGRAM_ID,
      cluster: "solana-devnet",
      instructions: [
        "commit_checkout",
        "release_escrow_to_merchant",
        "refund_escrow_to_depositor",
        "mark_paid",
      ],
      checkoutPdaSeeds: ["checkout", "<sha256_utf8_order_id_32_bytes>"],
      commitCheckout: {
        description:
          "`commit_checkout` creates the checkout PDA and an empty USDC vault (ATA) it owns. Fund the vault via SPL transfer, then `release_escrow_to_merchant` (merchant) or `refund_escrow_to_depositor` (depositor). See maxis-anchor/README.md.",
        merchant: merchant.payoutWallet,
        amountMicroUsdc,
        orderIdSha256Hex: sha256HexUtf8(order.id),
        paymentRequestIdSha256Hex: sha256HexUtf8(paymentRequestId),
      },
      settlement: {
        mode: "pda_escrow_vault",
        usdcMint: USDC_MINT_DEVNET,
        splTokenProgramId: TOKEN_PROGRAM_ID.toBase58(),
        decimals: 6,
        checkoutPda: settlement.checkoutPda,
        escrowVaultAta: settlement.escrowVaultAta,
        recommendedFlow: [
          "Build `commit_checkout` (payer = buyer; includes `usdc_mint` + init `escrow_vault` ATA).",
          "Send SPL `transfer` / `transferChecked`: buyer USDC ATA → `escrowVaultAta` (≥ amountMicroUsdc).",
          "Merchant: `release_escrow_to_merchant` OR buyer: `refund_escrow_to_depositor` (full vault).",
          "API `POST /orders/:id/pay` can still record a direct-to-merchant tx for the legacy path (recipient in 402 body).",
        ],
      },
    },
  });
});

app.post("/orders/:id/pay", async (req: Request, res: Response) => {
  const orderId = routeParam(req.params.id);
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { lines: true, merchant: true },
  });
  if (!order) {
    res.status(404).json({ error: "order_not_found" });
    return;
  }
  if (order.status !== OrderStatus.AWAITING_PAYMENT) {
    res.status(409).json({ error: "order_not_payable", status: order.status });
    return;
  }

  const parsed = zodBody(paySchema, req.body);

  if (!order.activePaymentRequestId) {
    res.status(400).json({
      error: "checkout_required",
      details: { message: "Call POST /orders/checkout first to receive HTTP 402." },
    });
    return;
  }
  if (parsed.paymentRequestId && parsed.paymentRequestId !== order.activePaymentRequestId) {
    res.status(400).json({ error: "invalid_payment_request_id" });
    return;
  }
  if (!parsed.paymentRequestId) {
    res
      .status(400)
      .json({ error: "payment_request_id_required", expected: order.activePaymentRequestId });
    return;
  }

  if (parsed.idempotencyKey) {
    const cacheKey = idempotencyCacheKey(order.id, parsed.idempotencyKey);
    const cached = await prisma.payIdempotency.findUnique({ where: { cacheKey } });
    if (cached) {
      res.status(cached.statusCode).json(cached.body as Record<string, unknown>);
      return;
    }
  }

  if (order.checkoutExpiresAt && Date.now() > order.checkoutExpiresAt.getTime()) {
    res.status(408).json({ error: "checkout_expired" });
    return;
  }

  let paidAmountUsd: number;
  try {
    paidAmountUsd = parseAmountToNumber(parsed.amount, parsed.amountUsd);
  } catch {
    res.status(400).json({ error: "invalid_amount_format" });
    return;
  }

  const merchant = order.merchant;
  const recipient = normalizeRecipient(parsed);
  if (recipient !== merchant.payoutWallet) {
    res.status(400).json({ error: "invalid_recipient", expectedRecipient: merchant.payoutWallet });
    return;
  }

  const expectedTotal = decToNum(order.totalUsd);
  if (paidAmountUsd !== roundUsd(expectedTotal)) {
    res.status(400).json({
      error: "invalid_amount",
      expected: expectedTotal.toFixed(2),
      received: paidAmountUsd.toFixed(2),
    });
    return;
  }
  if (parsed.reference !== order.id) {
    res.status(400).json({ error: "invalid_reference" });
    return;
  }

  const sigOwner = await prisma.order.findUnique({ where: { txSignature: parsed.txSignature } });
  if (sigOwner && sigOwner.id !== order.id) {
    res.status(409).json({ error: "duplicate_tx_signature" });
    return;
  }

  if (ONCHAIN_PAY_VERIFY) {
    const ov = await verifyUsdcPaymentToMerchant({
      rpcUrl: SOLANA_RPC_URL,
      signature: parsed.txSignature,
      merchantWalletBase58: merchant.payoutWallet,
      usdcMintBase58: USDC_MINT_DEVNET,
      expectedUsd: expectedTotal,
    });
    if (!ov.ok) {
      res.status(400).json({
        error: "onchain_verify_failed",
        code: ov.code,
        message: ov.message,
      });
      return;
    }
  }

  const paidAt = new Date();
  const lastPr = order.activePaymentRequestId;

  const okBody = {
    orderId: order.id,
    status: OrderStatus.PAID,
    txSignature: parsed.txSignature,
    paidAt: paidAt.toISOString(),
    paymentRequestId: lastPr,
  };

  await prisma.order.update({
    where: { id: order.id },
    data: {
      status: OrderStatus.PAID,
      activePaymentRequestId: null,
      lastPaymentRequestId: lastPr,
      txSignature: parsed.txSignature,
      paidAt,
      paymentAsset: parsed.asset,
      paymentChain: parsed.chain,
      paymentMint: USDC_MINT_DEVNET,
      paymentAmountDisplay: paidAmountUsd.toFixed(2),
      paymentUsd: paidAmountUsd,
      verifiedOnChain: ONCHAIN_PAY_VERIFY,
    },
  });

  if (parsed.idempotencyKey) {
    const cacheKey = idempotencyCacheKey(order.id, parsed.idempotencyKey);
    await prisma.payIdempotency.create({
      data: {
        cacheKey,
        statusCode: 200,
        body: okBody as unknown as Prisma.InputJsonValue,
      },
    });
  }

  res.json(okBody);
});

app.get("/orders/:id/status", async (req: Request, res: Response) => {
  const order = await prisma.order.findUnique({
    where: { id: routeParam(req.params.id) },
    include: { lines: true },
  });
  if (!order) {
    res.status(404).json({ error: "order_not_found" });
    return;
  }

  res.json({
    orderId: order.id,
    status: order.status,
    totalUsd: decToNum(order.totalUsd),
    payment: paymentJson(order),
    fulfillment: order.fulfillment,
  });
});

const patchProfileSchema = z
  .object({
    name: z.string().min(2).optional(),
    city: z.string().min(1).optional(),
    payoutWallet: z.string().optional(),
  })
  .superRefine((d, ctx) => {
    const hasAny =
      d.name !== undefined || d.city !== undefined || d.payoutWallet !== undefined;
    if (!hasAny) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "provide_at_least_one_field",
      });
    }
    if (d.payoutWallet !== undefined) {
      const t = d.payoutWallet.trim();
      if (!t) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "payout_wallet_empty",
          path: ["payoutWallet"],
        });
        return;
      }
      try {
        // eslint-disable-next-line no-new
        new PublicKey(t);
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "invalid_solana_address",
          path: ["payoutWallet"],
        });
      }
    }
  });

app.get("/dashboard/profile", authRequired, async (req: Request, res: Response) => {
  const merchant = await prisma.merchant.findUnique({
    where: { id: req.merchant!.sub },
  });
  if (!merchant) {
    res.status(404).json({ error: "merchant_not_found" });
    return;
  }
  res.json({
    id: merchant.id,
    name: merchant.name,
    slug: merchant.slug,
    city: merchant.city,
    email: merchant.email,
    payoutWallet: merchant.payoutWallet,
  });
});

app.patch("/dashboard/profile", authRequired, async (req: Request, res: Response) => {
  const parsed = zodBody(patchProfileSchema, req.body);
  const data: { name?: string; city?: string; payoutWallet?: string } = {};
  if (parsed.name !== undefined) data.name = parsed.name;
  if (parsed.city !== undefined) data.city = parsed.city;
  if (parsed.payoutWallet !== undefined) {
    data.payoutWallet = new PublicKey(parsed.payoutWallet.trim()).toBase58();
  }
  const merchant = await prisma.merchant.update({
    where: { id: req.merchant!.sub },
    data,
  });
  res.json({
    id: merchant.id,
    name: merchant.name,
    slug: merchant.slug,
    city: merchant.city,
    email: merchant.email,
    payoutWallet: merchant.payoutWallet,
  });
});

app.get("/dashboard/orders", authRequired, async (req: Request, res: Response) => {
  const orders = await prisma.order.findMany({
    where: { merchantId: req.merchant!.sub },
    include: { lines: true },
    orderBy: { createdAt: "desc" },
  });

  res.json({
    orders: orders.map((order) => ({
      orderId: order.id,
      merchantSlug: order.merchantSlug,
      status: order.status,
      totalUsd: decToNum(order.totalUsd),
      lines: order.lines.map((line) => ({
        itemId: line.catalogItemId,
        name: line.itemName,
        qty: line.qty,
        unitPriceUsd: decToNum(line.unitPriceUsd),
        lineTotalUsd: decToNum(line.lineTotalUsd),
      })),
      payment: paymentJson(order),
      createdAt: order.createdAt.toISOString(),
    })),
  });
});

app.patch("/dashboard/orders/:id/status", authRequired, async (req: Request, res: Response) => {
  const id = routeParam(req.params.id);
  const order = await prisma.order.findFirst({
    where: { id, merchantId: req.merchant!.sub },
  });
  if (!order) {
    res.status(404).json({ error: "order_not_found" });
    return;
  }

  const parsed = zodBody(updateStatusSchema, req.body);

  if (parsed.status === OrderStatus.ACCEPTED && order.status !== OrderStatus.PAID) {
    res.status(409).json({ error: "only_paid_orders_can_be_accepted" });
    return;
  }
  if (parsed.status === OrderStatus.READY && order.status !== OrderStatus.ACCEPTED) {
    res.status(409).json({ error: "only_accepted_orders_can_be_ready" });
    return;
  }
  if (parsed.status === OrderStatus.CANCELLED && order.status === OrderStatus.READY) {
    res.status(409).json({ error: "ready_orders_cannot_be_cancelled" });
    return;
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { status: parsed.status },
  });

  res.json({
    orderId: order.id,
    status: parsed.status,
  });
});

app.post("/dashboard/catalog", authRequired, async (req: Request, res: Response) => {
  const schema = z.object({
    merchantSlug: z.string().min(1),
    items: z
      .array(
        z.object({
          id: z.string().min(1),
          name: z.string().min(1),
          priceUsd: z.number().positive(),
          available: z.boolean().default(true),
        }),
      )
      .min(1),
  });
  const parsed = zodBody(schema, req.body);

  if (parsed.merchantSlug !== req.merchant!.slug) {
    res.status(403).json({ error: "forbidden" });
    return;
  }

  const merchant = await prisma.merchant.findFirst({
    where: { id: req.merchant!.sub, slug: parsed.merchantSlug },
  });
  if (!merchant) {
    res.status(404).json({ error: "merchant_not_found" });
    return;
  }

  await prisma.$transaction(async (tx) => {
    const keepIds = parsed.items.map((i) => i.id);
    await tx.catalogItem.deleteMany({
      where: { merchantId: merchant.id, id: { notIn: keepIds } },
    });

    for (const item of parsed.items) {
      const existing = await tx.catalogItem.findUnique({ where: { id: item.id } });
      if (existing && existing.merchantId !== merchant.id) {
        fail(409, "item_id_in_use", { id: item.id });
      }
      await tx.catalogItem.upsert({
        where: { id: item.id },
        create: {
          id: item.id,
          merchantId: merchant.id,
          name: item.name,
          priceUsd: item.priceUsd,
          available: item.available,
        },
        update: {
          name: item.name,
          priceUsd: item.priceUsd,
          available: item.available,
          merchantId: merchant.id,
        },
      });
    }
  });

  const count = await prisma.catalogItem.count({ where: { merchantId: merchant.id } });

  res.json({
    merchantSlug: merchant.slug,
    totalItems: count,
  });
});

app.use((req: Request, res: Response) => {
  res.status(404).json({ error: "not_found", path: req.path });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof SyntaxError && err !== null && typeof err === "object" && "body" in err) {
    res.status(400).json({ error: "invalid_json" });
    return;
  }

  if (err instanceof ApiError) {
    res.status(err.status).json({
      error: err.error,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  console.error("Unhandled API error:", err);
  res.status(500).json({ error: "internal_server_error" });
});

const server = app.listen(PORT, async () => {
  try {
    await prisma.$connect();
  } catch (e) {
    console.error("Database connection failed:", e);
    process.exit(1);
  }
  console.log(`MAXIS API running on http://localhost:${PORT}`);
  console.log("Demo merchant: north-star-cafe (after `npm run db:seed`)");
  console.log("Demo login: demo@maxis.local / demo123 → JWT Bearer for dashboard");
  if (ONCHAIN_PAY_VERIFY) {
    console.log("On-chain USDC pay verify: ENABLED (parsed transaction via RPC)");
  } else if (SOLANA_RPC_URL) {
    console.log("On-chain USDC pay verify: disabled (ONCHAIN_PAY_VERIFY=false)");
  } else {
    console.log(
      "On-chain USDC pay verify: OFF — set SOLANA_RPC_URL or HELIUS_RPC_URL (Helius-compatible) for USDC ATA credit checks.",
    );
  }
});

function shutdown(): void {
  server.close(() => {
    void prisma.$disconnect().then(() => process.exit(0));
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
