import express from "express";
import cors from "cors";
/** Zod v4 includes a stable v3 API surface (`zod/v3`) — use it for predictable optional keys. */
import { z } from "zod/v3";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT || 3001);
const DEMO_TOKEN = "demo-token";

/** SPL USDC mint on Solana devnet (override via env for your cluster). */
const USDC_MINT_DEVNET = process.env.USDC_MINT_DEVNET || "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

const CHECKOUT_TTL_MS = Number(process.env.CHECKOUT_TTL_MS || 10 * 60 * 1000);

const db = {
  merchants: [
    {
      id: "m_1",
      slug: "north-star-cafe",
      name: "North Star Cafe",
      city: "Bangalore",
      payoutWallet: "8H1payoutWalletDemoSolanaAddress",
      email: "demo@maxis.local",
      password: "demo123",
    },
  ],
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
  ],
  orders: [],
  /** @type {Map<string, { status: number; body: object }>} */
  payIdempotency: new Map(),
};

const OrderStatus = {
  AWAITING_PAYMENT: "AWAITING_PAYMENT",
  PAID: "PAID",
  ACCEPTED: "ACCEPTED",
  READY: "READY",
  CANCELLED: "CANCELLED",
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
    /** String like "9.00" (recommended) or number */
    amount: z.union([z.string(), z.number()]).optional(),
    /** @deprecated prefer `amount` */
    amountUsd: z.number().positive().optional(),
    recipient: z.string().min(8).optional(),
    /** @deprecated prefer `recipient` */
    recipientWallet: z.string().min(8).optional(),
    asset: z.literal("USDC"),
    chain: z.literal("solana-devnet"),
    reference: z.string().min(1),
  })
  .superRefine((data, ctx) => {
    const hasAmount =
      data.amount !== undefined ||
      data.amountUsd !== undefined;
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

function roundUsd(value) {
  return Math.round(value * 100) / 100;
}

function parseAmountToNumber(amount, amountUsd) {
  if (amountUsd != null) return roundUsd(amountUsd);
  if (typeof amount === "number") return roundUsd(amount);
  const n = Number(String(amount).trim());
  if (!Number.isFinite(n)) throw new Error("invalid_amount_format");
  return roundUsd(n);
}

function normalizeRecipient(parsed) {
  return parsed.recipient ?? parsed.recipientWallet;
}

function idempotencyCacheKey(orderId, idempotencyKey) {
  return `pay:${orderId}:${idempotencyKey}`;
}

class ApiError extends Error {
  constructor(status, error, details = undefined) {
    super(error);
    this.status = status;
    this.error = error;
    this.details = details;
  }
}

function fail(status, error, details = undefined) {
  throw new ApiError(status, error, details);
}

function requireMerchantById(merchantId) {
  const merchant = db.merchants.find((m) => m.id === merchantId);
  if (!merchant) fail(500, "merchant_record_missing");
  return merchant;
}

function zodBody(schema, body) {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    fail(400, "invalid_payload", { validation: parsed.error.flatten() });
  }
  return parsed.data;
}

function toPublicCatalogItem(item) {
  return {
    id: item.id,
    name: item.name,
    usd: item.priceUsd,
    available: item.available,
  };
}

function authRequired(req, res, next) {
  const auth = req.headers.authorization ?? "";
  if (auth !== `Bearer ${DEMO_TOKEN}`) {
    return res.status(401).json({ error: "unauthorized" });
  }
  return next();
}

function getMerchantBySlug(slug) {
  return db.merchants.find((m) => m.slug === slug);
}

function getOrder(orderId) {
  return db.orders.find((order) => order.id === orderId);
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "maxis-api" });
});

app.post("/auth/register", (req, res) => {
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
    return res.status(409).json({ error: "merchant_exists" });
  }

  const merchant = {
    id: `m_${crypto.randomUUID()}`,
    ...parsed,
  };
  db.merchants.push(merchant);

  return res.status(201).json({
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

app.post("/auth/login", (req, res) => {
  const bodySchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
  });
  const parsed = zodBody(bodySchema, req.body);

  const merchant = db.merchants.find(
    (m) => m.email.toLowerCase() === parsed.email.toLowerCase() && m.password === parsed.password,
  );
  if (!merchant) {
    return res.status(401).json({ error: "invalid_credentials" });
  }

  return res.json({
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

app.get("/merchants/:slug/catalog", (req, res) => {
  const merchant = getMerchantBySlug(req.params.slug);
  if (!merchant) {
    return res.status(404).json({ error: "merchant_not_found" });
  }

  const items = db.catalogItems
    .filter((item) => item.merchantId === merchant.id)
    .map((item) => toPublicCatalogItem(item));

  return res.json({
    merchant: {
      slug: merchant.slug,
      name: merchant.name,
      city: merchant.city,
    },
    currency: "USD",
    items,
  });
});

app.post("/orders", (req, res) => {
  const parsed = zodBody(createOrderSchema, req.body);

  const merchant = getMerchantBySlug(parsed.merchantSlug);
  if (!merchant) {
    return res.status(404).json({ error: "merchant_not_found" });
  }

  const lines = [];
  let totalUsd = 0;

  for (const requestItem of parsed.items) {
    const item = db.catalogItems.find(
      (catalogItem) => catalogItem.merchantId === merchant.id && catalogItem.id === requestItem.itemId,
    );
    if (!item || !item.available) {
      return res.status(400).json({ error: "item_unavailable", itemId: requestItem.itemId });
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
  const order = {
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

  return res.status(201).json({
    orderId: order.id,
    status: order.status,
    totalUsd: order.totalUsd,
    currency: "USD",
    fulfillment: order.fulfillment,
  });
});

app.post("/orders/checkout", (req, res) => {
  const parsed = zodBody(checkoutSchema, req.body);

  const order = getOrder(parsed.orderId);
  if (!order) {
    return res.status(404).json({ error: "order_not_found" });
  }
  if (order.status !== OrderStatus.AWAITING_PAYMENT) {
    return res.status(409).json({ error: "order_not_payable", status: order.status });
  }

  const merchant = requireMerchantById(order.merchantId);
  const paymentRequestId = `pr_${crypto.randomUUID()}`;
  order.activePaymentRequestId = paymentRequestId;
  order.checkoutExpiresAt = new Date(Date.now() + CHECKOUT_TTL_MS).toISOString();

  const amt = order.totalUsd.toFixed(2);

  return res.status(402).json({
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

app.post("/orders/:id/pay", (req, res) => {
  const order = getOrder(req.params.id);
  if (!order) {
    return res.status(404).json({ error: "order_not_found" });
  }
  if (order.status !== OrderStatus.AWAITING_PAYMENT) {
    return res.status(409).json({ error: "order_not_payable", status: order.status });
  }

  const parsed = zodBody(paySchema, req.body);

  if (!order.activePaymentRequestId) {
    return res.status(400).json({
      error: "checkout_required",
      details: { message: "Call POST /orders/checkout first to receive HTTP 402." },
    });
  }
  if (parsed.paymentRequestId && parsed.paymentRequestId !== order.activePaymentRequestId) {
    return res.status(400).json({ error: "invalid_payment_request_id" });
  }
  if (!parsed.paymentRequestId) {
    return res.status(400).json({ error: "payment_request_id_required", expected: order.activePaymentRequestId });
  }

  if (parsed.idempotencyKey) {
    const cacheKey = idempotencyCacheKey(order.id, parsed.idempotencyKey);
    const cached = db.payIdempotency.get(cacheKey);
    if (cached) {
      return res.status(cached.status).json(cached.body);
    }
  }

  if (order.checkoutExpiresAt && Date.now() > new Date(order.checkoutExpiresAt).getTime()) {
    return res.status(408).json({ error: "checkout_expired" });
  }

  let paidAmountUsd;
  try {
    paidAmountUsd = parseAmountToNumber(parsed.amount, parsed.amountUsd);
  } catch {
    return res.status(400).json({ error: "invalid_amount_format" });
  }

  const merchant = requireMerchantById(order.merchantId);
  const recipient = normalizeRecipient(parsed);
  if (recipient !== merchant.payoutWallet) {
    return res.status(400).json({ error: "invalid_recipient", expectedRecipient: merchant.payoutWallet });
  }
  if (paidAmountUsd !== roundUsd(order.totalUsd)) {
    return res.status(400).json({
      error: "invalid_amount",
      expected: order.totalUsd.toFixed(2),
      received: paidAmountUsd.toFixed(2),
    });
  }
  if (parsed.reference !== order.id) {
    return res.status(400).json({ error: "invalid_reference" });
  }
  if (db.orders.some((o) => o.payment?.txSignature === parsed.txSignature)) {
    return res.status(409).json({ error: "duplicate_tx_signature" });
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

  return res.json(okBody);
});

app.get("/orders/:id/status", (req, res) => {
  const order = getOrder(req.params.id);
  if (!order) {
    return res.status(404).json({ error: "order_not_found" });
  }

  return res.json({
    orderId: order.id,
    status: order.status,
    totalUsd: order.totalUsd,
    payment: order.payment,
    fulfillment: order.fulfillment,
  });
});

app.get("/dashboard/orders", authRequired, (_req, res) => {
  const orders = db.orders.map((order) => ({
    orderId: order.id,
    merchantSlug: order.merchantSlug,
    status: order.status,
    totalUsd: order.totalUsd,
    lines: order.lines,
    payment: order.payment,
    createdAt: order.createdAt,
  }));
  return res.json({ orders });
});

app.patch("/dashboard/orders/:id/status", authRequired, (req, res) => {
  const order = getOrder(req.params.id);
  if (!order) {
    return res.status(404).json({ error: "order_not_found" });
  }

  const parsed = zodBody(updateStatusSchema, req.body);

  if (parsed.status === OrderStatus.ACCEPTED && order.status !== OrderStatus.PAID) {
    return res.status(409).json({ error: "only_paid_orders_can_be_accepted" });
  }
  if (parsed.status === OrderStatus.READY && order.status !== OrderStatus.ACCEPTED) {
    return res.status(409).json({ error: "only_accepted_orders_can_be_ready" });
  }
  if (parsed.status === OrderStatus.CANCELLED && order.status === OrderStatus.READY) {
    return res.status(409).json({ error: "ready_orders_cannot_be_cancelled" });
  }

  order.status = parsed.status;
  return res.json({
    orderId: order.id,
    status: order.status,
  });
});

app.post("/dashboard/catalog", authRequired, (req, res) => {
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
    return res.status(404).json({ error: "merchant_not_found" });
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

  return res.json({
    merchantSlug: merchant.slug,
    totalItems: db.catalogItems.filter((item) => item.merchantId === merchant.id).length,
  });
});

app.use((req, res) => {
  res.status(404).json({ error: "not_found", path: req.path });
});

app.use((err, _req, res, _next) => {
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({ error: "invalid_json" });
  }

  if (err instanceof ApiError) {
    return res.status(err.status).json({
      error: err.error,
      ...(err.details ? { details: err.details } : {}),
    });
  }

  console.error("Unhandled API error:", err);
  return res.status(500).json({ error: "internal_server_error" });
});

app.listen(PORT, () => {
  console.log(`MAXIS API running on http://localhost:${PORT}`);
  console.log("Demo merchant: north-star-cafe");
  console.log("Demo login: demo@maxis.local / demo123");
  console.log(`Demo bearer token: ${DEMO_TOKEN}`);
});
