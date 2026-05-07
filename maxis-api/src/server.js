import express from "express";
import cors from "cors";
import { z } from "zod";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT || 3001);
const DEMO_TOKEN = "demo-token";

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

const paySchema = z.object({
  txSignature: z.string().min(10),
  amountUsd: z.number().positive(),
  recipientWallet: z.string().min(8),
  asset: z.literal("USDC"),
  chain: z.literal("solana-devnet"),
  reference: z.string().min(1),
});

const updateStatusSchema = z.object({
  status: z.enum([OrderStatus.ACCEPTED, OrderStatus.READY, OrderStatus.CANCELLED]),
});

function roundUsd(value) {
  return Math.round(value * 100) / 100;
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

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
  }

  const exists = db.merchants.some(
    (m) => m.slug === parsed.data.slug || m.email.toLowerCase() === parsed.data.email.toLowerCase(),
  );
  if (exists) {
    return res.status(409).json({ error: "merchant_exists" });
  }

  const merchant = {
    id: `m_${crypto.randomUUID()}`,
    ...parsed.data,
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
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
  }

  const merchant = db.merchants.find(
    (m) =>
      m.email.toLowerCase() === parsed.data.email.toLowerCase() && m.password === parsed.data.password,
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
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
  }

  const merchant = getMerchantBySlug(parsed.data.merchantSlug);
  if (!merchant) {
    return res.status(404).json({ error: "merchant_not_found" });
  }

  const lines = [];
  let totalUsd = 0;

  for (const requestItem of parsed.data.items) {
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
    fulfillment: parsed.data.fulfillment ?? { type: "pickup" },
    createdAt: new Date().toISOString(),
    checkoutExpiresAt: null,
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
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
  }

  const order = getOrder(parsed.data.orderId);
  if (!order) {
    return res.status(404).json({ error: "order_not_found" });
  }
  if (order.status !== OrderStatus.AWAITING_PAYMENT) {
    return res.status(409).json({ error: "order_not_payable", status: order.status });
  }

  const merchant = db.merchants.find((m) => m.id === order.merchantId);
  order.checkoutExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  return res.status(402).json({
    error: "payment_required",
    orderId: order.id,
    amountUsd: order.totalUsd,
    currency: "USD",
    asset: "USDC",
    chain: "solana-devnet",
    recipientWallet: merchant.payoutWallet,
    reference: order.id,
    expiresAt: order.checkoutExpiresAt,
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

  const parsed = paySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
  }

  if (order.checkoutExpiresAt && Date.now() > new Date(order.checkoutExpiresAt).getTime()) {
    return res.status(408).json({ error: "checkout_expired" });
  }

  const merchant = db.merchants.find((m) => m.id === order.merchantId);
  if (parsed.data.recipientWallet !== merchant.payoutWallet) {
    return res.status(400).json({ error: "invalid_recipient_wallet" });
  }
  if (roundUsd(parsed.data.amountUsd) !== roundUsd(order.totalUsd)) {
    return res.status(400).json({ error: "invalid_amount", expected: order.totalUsd });
  }
  if (parsed.data.reference !== order.id) {
    return res.status(400).json({ error: "invalid_reference" });
  }
  if (db.orders.some((o) => o.payment?.txSignature === parsed.data.txSignature)) {
    return res.status(409).json({ error: "duplicate_tx_signature" });
  }

  order.payment = {
    txSignature: parsed.data.txSignature,
    amountUsd: parsed.data.amountUsd,
    paidAt: new Date().toISOString(),
    asset: parsed.data.asset,
    chain: parsed.data.chain,
  };
  order.status = OrderStatus.PAID;

  return res.json({
    orderId: order.id,
    status: order.status,
    txSignature: order.payment.txSignature,
    paidAt: order.payment.paidAt,
  });
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

  const parsed = updateStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
  }

  if (parsed.data.status === OrderStatus.ACCEPTED && order.status !== OrderStatus.PAID) {
    return res.status(409).json({ error: "only_paid_orders_can_be_accepted" });
  }
  if (parsed.data.status === OrderStatus.READY && order.status !== OrderStatus.ACCEPTED) {
    return res.status(409).json({ error: "only_accepted_orders_can_be_ready" });
  }
  if (parsed.data.status === OrderStatus.CANCELLED && order.status === OrderStatus.READY) {
    return res.status(409).json({ error: "ready_orders_cannot_be_cancelled" });
  }

  order.status = parsed.data.status;
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
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
  }

  const merchant = getMerchantBySlug(parsed.data.merchantSlug);
  if (!merchant) {
    return res.status(404).json({ error: "merchant_not_found" });
  }

  const existingIds = new Set(parsed.data.items.map((item) => item.id));
  db.catalogItems = db.catalogItems.filter(
    (item) => item.merchantId !== merchant.id || existingIds.has(item.id),
  );

  for (const item of parsed.data.items) {
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

app.listen(PORT, () => {
  console.log(`MAXIS API running on http://localhost:${PORT}`);
  console.log("Demo merchant: north-star-cafe");
  console.log("Demo login: demo@maxis.local / demo123");
  console.log(`Demo bearer token: ${DEMO_TOKEN}`);
});
