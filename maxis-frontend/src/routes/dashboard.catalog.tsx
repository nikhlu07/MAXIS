import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import type { DemoCatalogItemUi } from "@maxis/demo-data";
import { demoCatalogAsUiItems } from "@maxis/demo-data";
import { apiRequest } from "@/lib/api";
import { getAuthToken, getMerchantSlug, isOfflineDemoSession } from "@/lib/auth";

export const Route = createFileRoute("/dashboard/catalog")({
  head: () => ({ meta: [{ title: "Catalog — M.A.X.I.S." }] }),
  component: CatalogPage,
});

type Item = DemoCatalogItemUi;

type CatalogSource = "loading" | "api" | "fixture";

function mapApiCatalogToItems(
  rows: Array<{ id: string; name: string; usd: number; available: boolean }>,
): Item[] {
  const byId = new Map(demoCatalogAsUiItems().map((i) => [i.id, i] as const));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    usd: r.usd,
    available: r.available,
    category: byId.get(r.id)?.category,
  }));
}

function CatalogPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [source, setSource] = useState<CatalogSource>("loading");
  const [name, setName] = useState("");
  const [usd, setUsd] = useState("");
  const [cat, setCat] = useState("");
  const [statusMsg, setStatusMsg] = useState("");

  const loadCatalog = useCallback(async () => {
    if (isOfflineDemoSession()) {
      setItems(demoCatalogAsUiItems());
      setSource("fixture");
      return;
    }
    setSource("loading");
    try {
      const slug = getMerchantSlug();
      const data = await apiRequest<{
        items: Array<{ id: string; name: string; usd: number; available: boolean }>;
      }>(`/merchants/${slug}/catalog`);
      setItems(mapApiCatalogToItems(data.items ?? []));
      setSource("api");
    } catch {
      setItems(demoCatalogAsUiItems());
      setSource("fixture");
    }
  }, []);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const subtitle =
    source === "loading"
      ? "Loading catalog…"
        : source === "api"
          ? "Loaded from API (Postgres / Supabase via Prisma backend)"
          : isOfflineDemoSession()
            ? "Sample mode · bundled fixtures only (nothing is saved)"
            : "API unreachable · showing fixtures from shared/maxis-demo-data.ts";

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !usd) return;
    setItems((c) => [
      ...c,
      {
        id: `it_${Math.random().toString(36).slice(2, 7)}`,
        name,
        usd: parseFloat(usd),
        category: cat || undefined,
        available: true,
      },
    ]);
    setName("");
    setUsd("");
    setCat("");
  };

  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="size-2 bg-primary" />
        <h1 className="font-mono uppercase tracking-[0.2em] text-sm">Menu / Catalog</h1>
      </div>
      <div className="text-muted-foreground text-sm mt-1">{subtitle}</div>

      <div className="flex gap-3 mt-6">
        <button
          onClick={() => alert("Coming soon")}
          className="border border-hairline text-muted-foreground px-3 py-2 mono-label hover:text-foreground"
        >
          Import CSV
        </button>
        <button
          onClick={async () => {
            if (isOfflineDemoSession()) {
              setStatusMsg("Sample mode — connect API + database to save.");
              return;
            }
            setStatusMsg("");
            try {
              const token = getAuthToken();
              await apiRequest("/dashboard/catalog", {
                method: "POST",
                token,
                body: JSON.stringify({
                  merchantSlug: getMerchantSlug(),
                  items: items.map((it) => ({
                    id: it.id,
                    name: it.name,
                    priceUsd: it.usd,
                    available: it.available,
                  })),
                }),
              });
              setStatusMsg("Saved to API → stored in Postgres (e.g. Supabase)");
              await loadCatalog();
            } catch (err) {
              setStatusMsg(`save_failed: ${err instanceof Error ? err.message : "unknown_error"}`);
            }
          }}
          disabled={isOfflineDemoSession()}
          className="border border-primary text-primary px-3 py-2 mono-label disabled:opacity-40 disabled:pointer-events-none"
        >
          Save to API
        </button>
      </div>
      {statusMsg && <div className="mono-label text-muted-foreground mt-3">{statusMsg}</div>}

      <form
        onSubmit={add}
        className="mt-8 grid md:grid-cols-[2fr_1fr_1fr_auto] gap-3 border border-hairline p-4 bg-surface-1"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Item name"
          className="bg-black border border-hairline px-3 py-2 font-mono text-sm focus:border-primary outline-none"
        />
        <input
          value={usd}
          onChange={(e) => setUsd(e.target.value)}
          placeholder="USD price"
          inputMode="decimal"
          className="bg-black border border-hairline px-3 py-2 font-mono text-sm focus:border-primary outline-none"
        />
        <input
          value={cat}
          onChange={(e) => setCat(e.target.value)}
          placeholder="Category"
          className="bg-black border border-hairline px-3 py-2 font-mono text-sm focus:border-primary outline-none"
        />
        <button className="bg-primary text-primary-foreground px-4 py-2 mono-label">Add ▸</button>
      </form>

      <div className="mt-6 border border-hairline">
        <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 px-4 py-3 mono-label text-muted-foreground border-b border-hairline bg-surface-1">
          <div>Name</div>
          <div>Price</div>
          <div>Category</div>
          <div>Available</div>
          <div></div>
        </div>
        {items.map((it) => (
          <div
            key={it.id}
            className="grid grid-cols-2 md:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 px-4 py-3 border-b border-hairline last:border-0 items-center"
          >
            <div className="font-medium">
              {it.name} <span className="font-mono text-xs text-muted-foreground">· {it.id}</span>
            </div>
            <div>
              <label className="sr-only" htmlFor={`price-${it.id}`}>
                Price USD
              </label>
              <input
                id={`price-${it.id}`}
                type="number"
                inputMode="decimal"
                min={0.01}
                step="0.01"
                value={Number.isFinite(it.usd) ? it.usd : 0}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (Number.isNaN(v)) return;
                  setItems((c) => c.map((x) => (x.id === it.id ? { ...x, usd: v } : x)));
                }}
                className="w-full max-w-[7rem] bg-black border border-hairline px-2 py-1.5 font-mono text-sm focus:border-primary outline-none"
              />
            </div>
            <div className="text-sm text-muted-foreground">{it.category ?? "—"}</div>
            <div>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={it.available}
                  onChange={(e) =>
                    setItems((c) =>
                      c.map((x) => (x.id === it.id ? { ...x, available: e.target.checked } : x)),
                    )
                  }
                  className="accent-primary"
                />
                <span className="mono-label text-muted-foreground">
                  {it.available ? "ON" : "OFF"}
                </span>
              </label>
            </div>
            <button
              onClick={() => setItems((c) => c.filter((x) => x.id !== it.id))}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
