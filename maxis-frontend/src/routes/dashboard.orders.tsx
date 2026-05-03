import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/orders")({
  head: () => ({ meta: [{ title: "Orders — M.A.X.I.S." }] }),
  component: OrdersPage,
});

type Status = "PENDING" | "PAID" | "FULFILLED";
type Order = {
  id: string;
  created: string;
  total: number;
  status: Status;
  items: { name: string; qty: number }[];
};

const SEED: Order[] = [
  {
    id: "ord_8Hx3kL",
    created: "2025-05-02 09:14",
    total: 11.5,
    status: "PAID",
    items: [{ name: "Latte 12oz", qty: 2 }],
  },
  {
    id: "ord_3Yp9qM",
    created: "2025-05-02 09:02",
    total: 4.25,
    status: "PENDING",
    items: [{ name: "Espresso", qty: 1 }],
  },
  {
    id: "ord_Z1mNpQ",
    created: "2025-05-02 08:41",
    total: 18.0,
    status: "FULFILLED",
    items: [
      { name: "Cold Brew", qty: 2 },
      { name: "Croissant", qty: 1 },
    ],
  },
];

const FILTERS: Array<Status | "ALL"> = ["ALL", "PENDING", "PAID", "FULFILLED"];

function OrdersPage() {
  const [orders, setOrders] = useState(SEED);
  const [filter, setFilter] = useState<Status | "ALL">("ALL");
  const [open, setOpen] = useState<string | null>(null);

  const visible = filter === "ALL" ? orders : orders.filter((o) => o.status === filter);

  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="size-2 bg-primary" />
        <h1 className="font-mono uppercase tracking-[0.2em] text-sm text-foreground">Orders</h1>
      </div>
      <div className="text-muted-foreground text-sm mt-1">Live feed · demo data</div>

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
                    onClick={() =>
                      setOrders((cur) =>
                        cur.map((c) => (c.id === o.id ? { ...c, status: "FULFILLED" } : c)),
                      )
                    }
                    className="bg-primary text-primary-foreground px-3 py-1.5 mono-label"
                  >
                    Mark fulfilled
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
    PENDING: "border-primary text-primary",
    PAID: "border-success text-success",
    FULFILLED: "border-hairline text-muted-foreground",
  };
  return <span className={cn("inline-block px-2 py-0.5 border mono-label", map[s])}>{s}</span>;
}
