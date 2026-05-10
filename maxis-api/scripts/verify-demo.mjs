/**
 * Golden-path smoke test (no bash): health → order → 402 checkout → pay → dashboard → READY.
 * Run with API up: `npm run verify:demo`
 * Env: API_BASE_URL (default http://127.0.0.1:3001)
 */

const BASE = (process.env.API_BASE_URL || "http://127.0.0.1:3001").replace(/\/$/, "");

const MERCHANT_SLUG = "north-star-cafe";
const ITEM_ID = "item_latte_sm";
const DEMO_EMAIL = "demo@maxis.local";
const DEMO_PASSWORD = "demo123";

async function json(res) {
  const t = await res.text();
  try {
    return t ? JSON.parse(t) : null;
  } catch {
    throw new Error(`invalid_json: ${t?.slice(0, 200)}`);
  }
}

async function main() {
  console.log(`== MAXIS verify:demo → ${BASE}`);

  let r = await fetch(`${BASE}/health`);
  if (!r.ok) throw new Error(`GET /health → ${r.status}`);
  const health = await json(r);
  if (!health?.ok) throw new Error("GET /health missing ok: true");

  r = await fetch(`${BASE}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      merchantSlug: MERCHANT_SLUG,
      items: [{ itemId: ITEM_ID, qty: 1 }],
    }),
  });
  if (!r.ok) throw new Error(`POST /orders → ${r.status}`);
  const order = await json(r);
  const oid = order?.orderId;
  if (!oid || order.status !== "AWAITING_PAYMENT") throw new Error("POST /orders bad body");

  r = await fetch(`${BASE}/orders/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId: oid }),
  });
  if (r.status !== 402) {
    const b = await r.text();
    throw new Error(`POST /orders/checkout expected 402, got ${r.status}: ${b.slice(0, 300)}`);
  }
  const chk = await json(r);
  if (!chk?.paymentRequestId || !chk?.amount || !chk?.recipient) throw new Error("402 body incomplete");

  const idem = `idem_verify_${Date.now()}`;
  r = await fetch(`${BASE}/orders/${encodeURIComponent(oid)}/pay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      paymentRequestId: chk.paymentRequestId,
      txSignature: `demo_tx_sig_verify_run_${Date.now()}`,
      amount: String(chk.amount),
      recipient: chk.recipient,
      asset: "USDC",
      chain: "solana-devnet",
      reference: oid,
      idempotencyKey: idem,
    }),
  });
  if (!r.ok) throw new Error(`POST /pay → ${r.status}`);
  const pay = await json(r);
  if (pay?.status !== "PAID") throw new Error("pay did not return PAID");

  r = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
  });
  if (!r.ok) throw new Error(`POST /auth/login → ${r.status}`);
  const auth = await json(r);
  const token = auth?.token;
  if (!token) throw new Error("no JWT from login");

  r = await fetch(`${BASE}/dashboard/orders`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`GET /dashboard/orders → ${r.status}`);
  const dash = await json(r);
  const ids = (dash.orders || []).map((o) => o.orderId);
  if (!ids.includes(oid)) throw new Error("order not in dashboard list");

  for (const st of ["ACCEPTED", "READY"]) {
    r = await fetch(`${BASE}/dashboard/orders/${encodeURIComponent(oid)}/status`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: st }),
    });
    if (!r.ok) throw new Error(`PATCH ${st} → ${r.status}`);
    const body = await json(r);
    if (body?.status !== st) throw new Error(`PATCH expected ${st}`);
  }

  r = await fetch(`${BASE}/orders/${encodeURIComponent(oid)}/status`);
  if (!r.ok) throw new Error(`GET /orders/:id/status → ${r.status}`);
  const stFinal = await json(r);
  if (stFinal?.status !== "READY") throw new Error("final status not READY");

  console.log("== All steps passed.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
