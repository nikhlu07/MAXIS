import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/api";
import { getAuthToken, getMerchantSlug } from "@/lib/auth";

export const Route = createFileRoute("/dashboard/orders")({
  head: () => ({ meta: [{ title: "Orders — M.A.X.I.S." }] }),
  component: OrdersPage,
});

type Status = "AWAITING_PAYMENT" | "PAID" | "ACCEPTED" | "READY" | "CANCELLED";
type Order = {
  id: string;
  created: string;
  total: number;
  status: Status;
  items: { name: string; qty: number; unitPriceUsd?: number }[];
  txSignature?: string;
};

const FILTERS: Array<Status | "ALL"> = [
  "ALL",
  "AWAITING_PAYMENT",
  "PAID",
  "ACCEPTED",
  "READY",
  "CANCELLED",
];

type CatalogItem = { id: string; name: string; usd: number; available: boolean };
type Checkout402 = {
  error: "payment_required";
  orderId: string;
  paymentRequestId: string;
  amount: string;
  recipient: string;
  reference: string;
  expiresAt: string;
};

function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<Status | "ALL">("ALL");
  const [open, setOpen] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [selectedItem, setSelectedItem] = useState("");
  const [qty, setQty] = useState(1);
  const [agentOrderId, setAgentOrderId] = useState("");
  const [checkout402, setCheckout402] = useState<Checkout402 | null>(null);
  const [agentMsg, setAgentMsg] = useState("");

  const visible = filter === "ALL" ? orders : orders.filter((o) => o.status === filter);

  async function loadOrders() {
    setError("");
    try {
      const token = getAuthToken();
      const data = await apiRequest<{
        orders: Array<{
          orderId: string;
          createdAt: string;
          totalUsd: number;
          status: Status;
          lines: Array<{ name: string; qty: number; unitPriceUsd: number }>;
          payment?: { txSignature?: string };
        }>;
      }>("/dashboard/orders", { token });

      setOrders(
        data.orders.map((o) => ({
          id: o.orderId,
          created: new Date(o.createdAt).toLocaleString(),
          total: o.totalUsd,
          status: o.status,
          items: o.lines ?? [],
          txSignature: o.payment?.txSignature,
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "load_failed");
    } finally {
      setLoading(false);
    }
  }

  async function loadCatalog() {
    try {
      const data = await apiRequest<{ items: CatalogItem[] }>(
        `/merchants/${getMerchantSlug()}/catalog`,
      );
      setCatalog(data.items ?? []);
      if (!selectedItem && data.items?.length) setSelectedItem(data.items[0].id);
    } catch {
      // keep quiet; orders view can still function without this panel
    }
  }

  async function updateStatus(orderId: string, nextStatus: "ACCEPTED" | "READY") {
    setError("");
    try {
      const token = getAuthToken();
      await apiRequest(`/dashboard/orders/${orderId}/status`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ status: nextStatus }),
      });
      await loadOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "update_status_failed");
    }
  }

  useEffect(() => {
    void loadOrders();
    void loadCatalog();
    // Intentionally once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only
  }, []);

  async function createAgentOrder() {
    setAgentMsg("");
    setCheckout402(null);
    try {
      const data = await apiRequest<{ orderId: string }>("/orders", {
        method: "POST",
        body: JSON.stringify({
          merchantSlug: getMerchantSlug(),
          items: [{ itemId: selectedItem, qty }],
          fulfillment: { type: "pickup" },
        }),
      });
      setAgentOrderId(data.orderId);
      setAgentMsg(`Order created: ${data.orderId}`);
      await loadOrders();
    } catch (err) {
      setAgentMsg(`create_order_failed: ${err instanceof Error ? err.message : "unknown_error"}`);
    }
  }

  async function request402() {
    if (!agentOrderId) return;
    setAgentMsg("");
    try {
      const body = await apiRequest<Checkout402>("/orders/checkout", {
        method: "POST",
        body: JSON.stringify({ orderId: agentOrderId }),
        allowHttpStatuses: [402],
      });
      setCheckout402(body);
      setAgentMsg("Received 402 challenge.");
    } catch (err) {
      setAgentMsg(`checkout_failed: ${err instanceof Error ? err.message : "unknown_error"}`);
    }
  }

  async function submitPayProof() {
    if (!agentOrderId || !checkout402) return;
    setAgentMsg("");
    try {
      const txSignature = `sig_${agentOrderId}_${Date.now()}`;
      await apiRequest(`/orders/${agentOrderId}/pay`, {
        method: "POST",
        body: JSON.stringify({
          paymentRequestId: checkout402.paymentRequestId,
          idempotencyKey: `idem_${agentOrderId}`,
          txSignature,
          amount: checkout402.amount,
          recipient: checkout402.recipient,
          asset: "USDC",
          chain: "solana-devnet",
          reference: checkout402.reference,
        }),
      });
      setAgentMsg("Payment proof accepted. Order is PAID.");
      await loadOrders();
    } catch (err) {
      setAgentMsg(`pay_failed: ${err instanceof Error ? err.message : "unknown_error"}`);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="size-2 bg-primary" />
        <h1 className="font-mono uppercase tracking-[0.2em] text-sm text-foreground">Orders</h1>
      </div>
      <div className="text-muted-foreground text-sm mt-1">Live feed · API-backed</div>
      {error && <div className="mono-label text-destructive mt-3">{error}</div>}
      {loading && <div className="mono-label text-muted-foreground mt-3">Loading...</div>}

      <div className="mt-6 border border-hairline bg-surface-1 p-4">
        <div className="mono-label text-muted-foreground mb-3">Agentic Checkout UI</div>
        <div className="grid md:grid-cols-[2fr_1fr_auto_auto_auto] gap-3 items-end">
          <label className="block">
            <div className="mono-label text-muted-foreground mb-1">Catalog item</div>
            <select
              value={selectedItem}
              onChange={(e) => setSelectedItem(e.target.value)}
              className="w-full bg-black border border-hairline px-3 py-2 font-mono text-sm"
            >
              {catalog.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} (${c.usd.toFixed(2)})
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <div className="mono-label text-muted-foreground mb-1">Qty</div>
            <input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Number(e.target.value || 1)))}
              className="w-full bg-black border border-hairline px-3 py-2 font-mono text-sm"
            />
          </label>
          <button
            onClick={createAgentOrder}
            className="border border-hairline px-3 py-2 mono-label"
          >
            1) Create order
          </button>
          <button
            onClick={request402}
            disabled={!agentOrderId}
            className="border border-primary text-primary px-3 py-2 mono-label disabled:opacity-50"
          >
            2) Get 402
          </button>
          <button
            onClick={submitPayProof}
            disabled={!checkout402}
            className="bg-primary text-primary-foreground px-3 py-2 mono-label disabled:opacity-50"
          >
            3) Submit pay
          </button>
        </div>
        {agentOrderId && (
          <div className="mono-label text-muted-foreground mt-3">orderId: {agentOrderId}</div>
        )}
        {checkout402 && (
          <pre className="mt-3 p-3 border border-hairline bg-black text-xs font-mono overflow-x-auto">
            {JSON.stringify(checkout402, null, 2)}
          </pre>
        )}
        {agentMsg && <div className="mono-label text-muted-foreground mt-3">{agentMsg}</div>}
      </div>

      <div className="flex flex-wrap gap-2 mt-6">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-3 py-1.5 mono-label border",
              filter === f
                ? "border-primary text-primary bg-primary/5"
                : "border-hairline text-muted-foreground hover:text-foreground",
            )}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="mt-6 border border-hairline">
        <div className="hidden md:grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-4 px-4 py-3 mono-label text-muted-foreground border-b border-hairline bg-surface-1">
          <div>Order ID</div>
          <div>Created</div>
          <div>Total</div>
          <div>Status</div>
          <div>Action</div>
        </div>
        {visible.map((o) => (
          <div key={o.id} className="border-b border-hairline last:border-0">
            <div
              className="grid grid-cols-2 md:grid-cols-[1fr_1fr_1fr_1fr_auto] gap-4 px-4 py-3 items-center cursor-pointer hover:bg-surface-1"
              onClick={() => setOpen(open === o.id ? null : o.id)}
            >
              <div className="font-mono text-sm flex items-center gap-2">
                {open === o.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                {o.id}
              </div>
              <div className="font-mono text-xs text-muted-foreground">{o.created}</div>
              <div className="font-mono text-sm">${o.total.toFixed(2)}</div>
              <div>
                <StatusBadge s={o.status} />
              </div>
              <div onClick={(e) => e.stopPropagation()}>
                {o.status === "PAID" ? (
                  <button
                    onClick={() => updateStatus(o.id, "ACCEPTED")}
                    className="bg-primary text-primary-foreground px-3 py-1.5 mono-label"
                  >
                    Accept
                  </button>
                ) : o.status === "ACCEPTED" ? (
                  <button
                    onClick={() => updateStatus(o.id, "READY")}
                    className="bg-primary text-primary-foreground px-3 py-1.5 mono-label"
                  >
                    Mark ready
                  </button>
                ) : (
                  <span className="mono-label text-muted-foreground">—</span>
                )}
              </div>
            </div>
            {open === o.id && (
              <div className="px-8 py-4 bg-surface-1 border-t border-hairline">
                <div className="mono-label text-muted-foreground mb-2">Line items</div>
                <ul className="space-y-1 font-mono text-sm">
                  {o.items.map((it, i) => (
                    <li key={i} className="flex justify-between max-w-sm">
                      <span>{it.name}</span>
                      <span className="text-muted-foreground">× {it.qty}</span>
                    </li>
                  ))}
                </ul>
                {o.txSignature && (
                  <div className="mono-label text-muted-foreground mt-3">tx: {o.txSignature}</div>
                )}
              </div>
            )}
          </div>
        ))}
        {visible.length === 0 && (
          <div className="px-4 py-8 text-center text-muted-foreground mono-label">
            No orders match filter
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ s }: { s: Status }) {
  const map: Record<Status, string> = {
    AWAITING_PAYMENT: "border-primary text-primary",
    PAID: "border-success text-success",
    ACCEPTED: "border-primary text-primary",
    READY: "border-hairline text-muted-foreground",
    CANCELLED: "border-destructive text-destructive",
  };
  return <span className={cn("inline-block px-2 py-0.5 border mono-label", map[s])}>{s}</span>;
}
