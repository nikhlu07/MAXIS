import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { HudPanel, SectionLabel } from "@/components/maxis/HudPanel";
import { NavBar } from "@/components/maxis/NavBar";
import { Footer } from "@/components/maxis/Footer";
import { useState } from "react";
import { apiRequest } from "@/lib/api";
import { saveAuth } from "@/lib/auth";
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
  return (
    <div className="min-h-screen flex flex-col bg-black">
      <NavBar />
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <HudPanel className="w-full max-w-md bg-surface-1">
          <SectionLabel>Onboard · Demo mode</SectionLabel>
          <h2 className="text-2xl font-semibold mt-3">Create merchant account</h2>
          <form
            className="mt-6 space-y-4"
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
              try {
                const data = await apiRequest<{ token: string; merchant: { slug: string } }>(
                  "/auth/register",
                  {
                    method: "POST",
                    body: JSON.stringify({
                      name: shop,
                      slug: slug || `merchant-${Math.random().toString(36).slice(2, 7)}`,
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
                setErr(error instanceof Error ? error.message : "register_failed");
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
            Already have one?{" "}
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
