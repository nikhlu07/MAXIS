import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import { z } from "zod/v3";
import { verifyUsdcPaymentToMerchant } from "./solana-verify.js";
import type {
  CatalogItemRecord,
  MerchantRecord,
  OrderLine,
  OrderRecord,
  PayIdempotencyEntry,
} from "./types.js";
import { OrderStatus } from "./types.js";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT || 3001);
const DEMO_TOKEN = "demo-token";

const USDC_MINT_DEVNET = process.env.USDC_MINT_DEVNET ?? "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
const SOLANA_RPC_URL = (process.env.SOLANA_RPC_URL || process.env.HELIUS_RPC_URL || "").trim();
const ONCHAIN_PAY_VERIFY = process.env.ONCHAIN_PAY_VERIFY !== "false" && SOLANA_RPC_URL.length > 0;
const CHECKOUT_TTL_MS = Number(process.env.CHECKOUT_TTL_MS || 10 * 60 * 1000);

const db = {
  merchants: [
    {
      id: "m_1",
      slug: "north-star-cafe",
      name: "North Star Cafe",
      city: "Bangalore",
      payoutWallet: "CkkwHhMz3tiRcrdLGBRxLvaHchZqTUEFxNLxUcMzYdRZ",
      email: "demo@maxis.local",
      password: "demo123",
    },
  ] as MerchantRecord[],
  catalogItems: [
    {
      id: "item_latte_sm",
      merchantId: "m_1",
      name: "Latte Small",
      priceUsd: 4.5,
      available: true,
    },
    {
      id: "item_cap_md",
      merchantId: "m_1",
      name: "Cappuccino Medium",
      priceUsd: 5.0,
      available: true,
    },
    {
      id: "item_americano",
      merchantId: "m_1",
      name: "Americano",
      priceUsd: 3.75,
      available: true,
    },
  ] as CatalogItemRecord[],
  orders: [] as OrderRecord[],
  payIdempotency: new Map<string, PayIdempotencyEntry>(),
};

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

function requireMerchantById(merchantId: string): MerchantRecord {
  const merchant = db.merchants.find((m) => m.id === merchantId);
  if (!merchant) fail(500, "merchant_record_missing");
  return merchant;
}

function zodBody<T extends z.ZodType>(schema: T, body: unknown): z.infer<T> {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    fail(400, "invalid_payload", { validation: parsed.error.flatten() });
  }
  return parsed.data;
}

function toPublicCatalogItem(item: CatalogItemRecord) {
  return {
    id: item.id,
    name: item.name,
    usd: item.priceUsd,
    available: item.available,
  };
}

function authRequired(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization ?? "";
  if (auth !== `Bearer ${DEMO_TOKEN}`) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  next();
}

function getMerchantBySlug(slug: string): MerchantRecord | undefined {
  return db.merchants.find((m) => m.slug === slug);
}

function getOrder(orderId: string): OrderRecord | undefined {
  return db.orders.find((order) => order.id === orderId);
}

/** Express 5 may type `req.params` values as `string | string[]`. */
function routeParam(v: string | string[] | undefined): string {
  if (v == null) return "";
  return Array.isArray(v) ? (v[0] ?? "") : v;
}

app.get("/health", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    service: "maxis-api",
    onchainPayVerify: ONCHAIN_PAY_VERIFY,
  });
});

app.post("/auth/register", (req: Request, res: Response) => {
  const bodySchema = z.object({
    name: z.string().min(2),
    slug: z.string().min(2),
    city: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(6),
    payoutWallet: z.string().min(8),
  });

  const parsed = zodBody(bodySchema, req.body);

  const exists = db.merchants.some(
    (m) => m.slug === parsed.slug || m.email.toLowerCase() === parsed.email.toLowerCase(),
  );
  if (exists) {
    res.status(409).json({ error: "merchant_exists" });
    return;
  }

  const merchant: MerchantRecord = {
    id: `m_${crypto.randomUUID()}`,
    ...parsed,
  };
  db.merchants.push(merchant);

  res.status(201).json({
    merchant: {
      id: merchant.id,
      name: merchant.name,
      slug: merchant.slug,
      city: merchant.city,
      payoutWallet: merchant.payoutWallet,
    },
    token: DEMO_TOKEN,
  });
});

app.post("/auth/login", (req: Request, res: Response) => {
  const bodySchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
  });
  const parsed = zodBody(bodySchema, req.body);

  const merchant = db.merchants.find(
    (m) => m.email.toLowerCase() === parsed.email.toLowerCase() && m.password === parsed.password,
  );
  if (!merchant) {
    res.status(401).json({ error: "invalid_credentials" });
    return;
  }

  res.json({
    token: DEMO_TOKEN,
    merchant: {
      id: merchant.id,
      slug: merchant.slug,
      name: merchant.name,
      city: merchant.city,
      payoutWallet: merchant.payoutWallet,
    },
  });
});

app.get("/merchants/:slug/catalog", (req: Request, res: Response) => {
  const merchant = getMerchantBySlug(routeParam(req.params.slug));
  if (!merchant) {
    res.status(404).json({ error: "merchant_not_found" });
    return;
  }

  const items = db.catalogItems
    .filter((item) => item.merchantId === merchant.id)
    .map((item) => toPublicCatalogItem(item));

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

app.post("/orders", (req: Request, res: Response) => {
  const parsed = zodBody(createOrderSchema, req.body);

  const merchant = getMerchantBySlug(parsed.merchantSlug);
  if (!merchant) {
    res.status(404).json({ error: "merchant_not_found" });
    return;
  }

  const lines: OrderLine[] = [];
  let totalUsd = 0;

  for (const requestItem of parsed.items) {
    const item = db.catalogItems.find(
      (catalogItem) => catalogItem.merchantId === merchant.id && catalogItem.id === requestItem.itemId,
    );
    if (!item || !item.available) {
      res.status(400).json({ error: "item_unavailable", itemId: requestItem.itemId });
      return;
    }

    lines.push({
      itemId: item.id,
      name: item.name,
      qty: requestItem.qty,
      unitPriceUsd: item.priceUsd,
      lineTotalUsd: roundUsd(item.priceUsd * requestItem.qty),
    });
    totalUsd += item.priceUsd * requestItem.qty;
  }

  const orderId = `ord_${crypto.randomUUID()}`;
  const order: OrderRecord = {
    id: orderId,
    merchantId: merchant.id,
    merchantSlug: merchant.slug,
    lines,
    totalUsd: roundUsd(totalUsd),
    status: OrderStatus.AWAITING_PAYMENT,
    fulfillment: parsed.fulfillment ?? { type: "pickup" },
    createdAt: new Date().toISOString(),
    checkoutExpiresAt: null,
    activePaymentRequestId: null,
    payment: null,
  };
  db.orders.push(order);

  res.status(201).json({
    orderId: order.id,
    status: order.status,
    totalUsd: order.totalUsd,
    currency: "USD",
    fulfillment: order.fulfillment,
  });
});

app.post("/orders/checkout", (req: Request, res: Response) => {
  const parsed = zodBody(checkoutSchema, req.body);

  const order = getOrder(parsed.orderId);
  if (!order) {
    res.status(404).json({ error: "order_not_found" });
    return;
  }
  if (order.status !== OrderStatus.AWAITING_PAYMENT) {
    res.status(409).json({ error: "order_not_payable", status: order.status });
    return;
  }

  const merchant = requireMerchantById(order.merchantId);
  const paymentRequestId = `pr_${crypto.randomUUID()}`;
  order.activePaymentRequestId = paymentRequestId;
  order.checkoutExpiresAt = new Date(Date.now() + CHECKOUT_TTL_MS).toISOString();

  const amt = order.totalUsd.toFixed(2);

  res.status(402).json({
    error: "payment_required",
    orderId: order.id,
    paymentRequestId,
    amount: amt,
    amountUsd: order.totalUsd,
    currency: "USD",
    asset: "USDC",
    chain: "solana-devnet",
    mint: USDC_MINT_DEVNET,
    recipient: merchant.payoutWallet,
    recipientWallet: merchant.payoutWallet,
    reference: order.id,
    expiresAt: order.checkoutExpiresAt,
    verification: {
      requiredConfirmations: 1,
      commitment: "confirmed",
    },
  });
});

app.post("/orders/:id/pay", async (req: Request, res: Response) => {
  const order = getOrder(routeParam(req.params.id));
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
    const cached = db.payIdempotency.get(cacheKey);
    if (cached) {
      res.status(cached.status).json(cached.body);
      return;
    }
  }

  if (order.checkoutExpiresAt && Date.now() > new Date(order.checkoutExpiresAt).getTime()) {
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

  const merchant = requireMerchantById(order.merchantId);
  const recipient = normalizeRecipient(parsed);
  if (recipient !== merchant.payoutWallet) {
    res.status(400).json({ error: "invalid_recipient", expectedRecipient: merchant.payoutWallet });
    return;
  }
  if (paidAmountUsd !== roundUsd(order.totalUsd)) {
    res.status(400).json({
      error: "invalid_amount",
      expected: order.totalUsd.toFixed(2),
      received: paidAmountUsd.toFixed(2),
    });
    return;
  }
  if (parsed.reference !== order.id) {
    res.status(400).json({ error: "invalid_reference" });
    return;
  }
  if (db.orders.some((o) => o.payment?.txSignature === parsed.txSignature)) {
    res.status(409).json({ error: "duplicate_tx_signature" });
    return;
  }

  if (ONCHAIN_PAY_VERIFY) {
    const ov = await verifyUsdcPaymentToMerchant({
      rpcUrl: SOLANA_RPC_URL,
      signature: parsed.txSignature,
      merchantWalletBase58: merchant.payoutWallet,
      usdcMintBase58: USDC_MINT_DEVNET,
      expectedUsd: order.totalUsd,
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

  order.payment = {
    paymentRequestId: order.activePaymentRequestId,
    txSignature: parsed.txSignature,
    amount: paidAmountUsd.toFixed(2),
    amountUsd: paidAmountUsd,
    paidAt: new Date().toISOString(),
    asset: parsed.asset,
    chain: parsed.chain,
    mint: USDC_MINT_DEVNET,
    verifiedOnChain: ONCHAIN_PAY_VERIFY,
  };
  order.status = OrderStatus.PAID;
  order.activePaymentRequestId = null;

  const okBody = {
    orderId: order.id,
    status: order.status,
    txSignature: order.payment.txSignature,
    paidAt: order.payment.paidAt,
    paymentRequestId: order.payment.paymentRequestId,
  };

  if (parsed.idempotencyKey) {
    const cacheKey = idempotencyCacheKey(order.id, parsed.idempotencyKey);
    db.payIdempotency.set(cacheKey, { status: 200, body: okBody });
  }

  res.json(okBody);
});

app.get("/orders/:id/status", (req: Request, res: Response) => {
  const order = getOrder(routeParam(req.params.id));
  if (!order) {
    res.status(404).json({ error: "order_not_found" });
    return;
  }

  res.json({
    orderId: order.id,
    status: order.status,
    totalUsd: order.totalUsd,
    payment: order.payment,
    fulfillment: order.fulfillment,
  });
});

app.get("/dashboard/orders", authRequired, (_req: Request, res: Response) => {
  const orders = db.orders.map((order) => ({
    orderId: order.id,
    merchantSlug: order.merchantSlug,
    status: order.status,
    totalUsd: order.totalUsd,
    lines: order.lines,
    payment: order.payment,
    createdAt: order.createdAt,
  }));
  res.json({ orders });
});

app.patch("/dashboard/orders/:id/status", authRequired, (req: Request, res: Response) => {
  const order = getOrder(routeParam(req.params.id));
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

  order.status = parsed.status;
  res.json({
    orderId: order.id,
    status: order.status,
  });
});

app.post("/dashboard/catalog", authRequired, (req: Request, res: Response) => {
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

  const merchant = getMerchantBySlug(parsed.merchantSlug);
  if (!merchant) {
    res.status(404).json({ error: "merchant_not_found" });
    return;
  }

  const existingIds = new Set(parsed.items.map((item) => item.id));
  db.catalogItems = db.catalogItems.filter(
    (item) => item.merchantId !== merchant.id || existingIds.has(item.id),
  );

  for (const item of parsed.items) {
    const idx = db.catalogItems.findIndex(
      (catalogItem) => catalogItem.merchantId === merchant.id && catalogItem.id === item.id,
    );
    const record = { ...item, merchantId: merchant.id };
    if (idx >= 0) {
      db.catalogItems[idx] = record;
    } else {
      db.catalogItems.push(record);
    }
  }

  res.json({
    merchantSlug: merchant.slug,
    totalItems: db.catalogItems.filter((item) => item.merchantId === merchant.id).length,
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

app.listen(PORT, () => {
  console.log(`MAXIS API running on http://localhost:${PORT}`);
  console.log("Demo merchant: north-star-cafe");
  console.log("Demo login: demo@maxis.local / demo123");
  console.log(`Demo bearer token: ${DEMO_TOKEN}`);
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
