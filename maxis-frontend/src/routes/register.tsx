import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { HudPanel, SectionLabel } from "@/components/maxis/HudPanel";
import { NavBar } from "@/components/maxis/NavBar";
import { Footer } from "@/components/maxis/Footer";
import { useEffect, useState } from "react";
import { DEMO_MERCHANT } from "@maxis/demo-data";
import { apiRequest, fetchApiHealth } from "@/lib/api";
import { friendlyApiError } from "@/lib/api-user-errors";
import { enterOfflineDemoMode, saveAuth } from "@/lib/auth";
import { loginAsSeededDemo } from "@/lib/demo-session";
import { connectInjectedSolanaWallet, isValidSolanaAddress } from "@/lib/solana-wallet";

export const Route = createFileRoute("/register")({
  head: () => ({ meta: [{ title: "Create account — M.A.X.I.S." }] }),
  component: RegisterPage,
});

function RegisterPage() {
  const nav = useNavigate();
  const [shop, setShop] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [city, setCity] = useState("");
  const [payoutWallet, setPayoutWallet] = useState("");
  const [walletBusy, setWalletBusy] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [healthDb, setHealthDb] = useState<"unknown" | "ok" | "error">("unknown");

  useEffect(() => {
    void (async () => {
      const h = await fetchApiHealth();
      if (!h) {
        setHealthDb("error");
        return;
      }
      setHealthDb(h.database === "error" ? "error" : "ok");
    })();
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-black">
      <NavBar />
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <HudPanel className="w-full max-w-md bg-surface-1">
          <SectionLabel>New merchant</SectionLabel>
          <h2 className="text-2xl font-semibold mt-3">Create merchant account</h2>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            This form <strong className="text-foreground">writes a new row</strong> to Postgres (shop, email,
            payout). It is not the “demo tour.” For that, use{" "}
            <strong className="text-foreground">Try demo</strong> on sign-in — one tap, no shop name.
          </p>
          {healthDb === "error" && (
            <div className="mt-3 text-xs border border-warning/50 bg-warning/10 text-warning px-3 py-2 rounded mono-label leading-relaxed">
              Database unreachable from the API. Registration will fail until Postgres is up (resume Supabase,
              fix <code className="text-foreground">DATABASE_URL</code>). You can still open the{" "}
              <strong className="text-foreground">sample dashboard</strong> below.
            </div>
          )}
          <button
            type="button"
            disabled={loading}
            onClick={async () => {
              setErr("");
              setLoading(true);
              try {
                const { token, merchantSlug } = await loginAsSeededDemo();
                saveAuth(token, merchantSlug);
                nav({ to: "/dashboard/orders" });
              } catch (error) {
                const raw = error instanceof Error ? error.message : "login_failed";
                setErr(friendlyApiError(raw));
              } finally {
                setLoading(false);
              }
            }}
            className="w-full mt-4 bg-primary text-primary-foreground py-3 mono-label disabled:opacity-60 hover:opacity-95"
          >
            {loading ? "Opening…" : `Try demo instead · ${DEMO_MERCHANT.name}`}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              enterOfflineDemoMode();
              nav({ to: "/dashboard/orders" });
            }}
            className="w-full mt-3 border border-hairline py-2.5 mono-label text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 disabled:opacity-50"
          >
            Sample dashboard (no API) — UI + fixtures only
          </button>
          <div className="flex items-center gap-3 my-6">
            <div className="h-px flex-1 bg-hairline" />
            <span className="mono-label text-xs text-muted-foreground">new merchant form</span>
            <div className="h-px flex-1 bg-hairline" />
          </div>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (pw.length < 8) {
                setErr("Password must be ≥ 8 chars");
                return;
              }
              if (shop.trim().length < 2) {
                setErr("Shop name must be at least 2 characters.");
                return;
              }
              if (!isValidSolanaAddress(payoutWallet)) {
                setErr("Add a valid Solana payout address (connect wallet or paste).");
                return;
              }
              setErr("");
              setLoading(true);
              const slug = shop
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/(^-|-$)/g, "");
              const finalSlug = slug || `merchant-${Math.random().toString(36).slice(2, 7)}`;
              if (finalSlug === DEMO_MERCHANT.slug) {
                setErr(
                  `Shop name resolves to “${DEMO_MERCHANT.slug}”, which is reserved for the seeded demo. Pick a different shop name (e.g. “My Test Cafe”).`,
                );
                setLoading(false);
                return;
              }
              try {
                const data = await apiRequest<{ token: string; merchant: { slug: string } }>(
                  "/auth/register",
                  {
                    method: "POST",
                    body: JSON.stringify({
                      name: shop,
                      slug: finalSlug,
                      city: city.trim() || "Unknown",
                      email,
                      password: pw,
                      payoutWallet: payoutWallet.trim(),
                    }),
                  },
                );
                saveAuth(data.token, data.merchant.slug);
                nav({ to: "/dashboard/catalog" });
              } catch (error) {
                const raw = error instanceof Error ? error.message : "register_failed";
                setErr(friendlyApiError(raw));
              } finally {
                setLoading(false);
              }
            }}
          >
            <Field label="Shop name" value={shop} onChange={setShop} />
            <Field label="Email" type="email" value={email} onChange={setEmail} />
            <Field label="Password (min 8)" type="password" value={pw} onChange={setPw} />
            <Field label="City (optional)" value={city} onChange={setCity} />
            <div>
              <div className="mono-label text-muted-foreground mb-1.5">Solana payout address (USDC)</div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  value={payoutWallet}
                  onChange={(e) => setPayoutWallet(e.target.value.trim())}
                  placeholder="Connect wallet or paste base58 address"
                  spellCheck={false}
                  className="flex-1 bg-black border border-hairline px-3 py-2.5 font-mono text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  type="button"
                  disabled={walletBusy || loading}
                  onClick={async () => {
                    setErr("");
                    setWalletBusy(true);
                    try {
                      const addr = await connectInjectedSolanaWallet();
                      setPayoutWallet(addr);
                    } catch (error) {
                      setErr(error instanceof Error ? error.message : "wallet_connect_failed");
                    } finally {
                      setWalletBusy(false);
                    }
                  }}
                  className="shrink-0 border border-hairline px-4 py-2.5 mono-label text-primary hover:border-primary hover:bg-primary/5 disabled:opacity-50"
                >
                  {walletBusy ? "Connecting…" : "Connect wallet"}
                </button>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Public address only — where you receive USDC on Solana. Never paste a seed phrase.
              </p>
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  setErr("");
                  setPayoutWallet(DEMO_MERCHANT.payoutWallet);
                }}
                className="mt-2 text-xs mono-label text-primary hover:underline disabled:opacity-50"
              >
                Use sandbox payout from docs (same pubkey as demo seed — for testing only)
              </button>
            </div>
            {err && <div className="mono-label text-destructive">{err}</div>}
            <button
              disabled={loading}
              className="w-full bg-primary text-primary-foreground py-3 mono-label disabled:opacity-60"
            >
              {loading ? "Creating..." : "Create account ▸"}
            </button>
          </form>
          <p className="mt-6 mono-label text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="text-primary">
              Sign in →
            </Link>
          </p>
        </HudPanel>
      </div>
      <Footer />
    </div>
  );
}

function Field({
  label,
  type = "text",
  value,
  onChange,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <div className="mono-label text-muted-foreground mb-1.5">{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-black border border-hairline px-3 py-2.5 font-mono text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </label>
  );
}
