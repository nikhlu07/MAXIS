import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { DEMO_MERCHANT } from "@maxis/demo-data";
import { getAuthToken, isOfflineDemoSession } from "@/lib/auth";
import { fetchMerchantProfile, patchMerchantProfile } from "@/lib/dashboard-profile";
import { connectInjectedSolanaWallet, isValidSolanaAddress } from "@/lib/solana-wallet";

export const Route = createFileRoute("/dashboard/settings")({
  head: () => ({ meta: [{ title: "Settings — M.A.X.I.S." }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [walletBusy, setWalletBusy] = useState(false);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [payoutWallet, setPayoutWallet] = useState("");
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isOfflineDemoSession()) {
      setName(DEMO_MERCHANT.name);
      setCity(DEMO_MERCHANT.city);
      setPayoutWallet(DEMO_MERCHANT.payoutWallet);
      setEmail(DEMO_MERCHANT.email);
      setLoading(false);
      return;
    }
    const token = getAuthToken();
    if (!token) {
      nav({ to: "/login" });
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const p = await fetchMerchantProfile(token);
        if (cancelled) return;
        setName(p.name);
        setCity(p.city);
        setPayoutWallet(p.payoutWallet);
        setEmail(p.email);
      } catch (e) {
        if (cancelled) return;
        setErr(e instanceof Error ? e.message : "load_failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [nav]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isOfflineDemoSession()) {
      setErr("Sample mode — connect API to save settings.");
      return;
    }
    const token = getAuthToken();
    if (!token) {
      nav({ to: "/login" });
      return;
    }
    if (name.trim().length < 2) {
      setErr("Display name must be at least 2 characters.");
      return;
    }
    if (!isValidSolanaAddress(payoutWallet)) {
      setErr("Payout address must be a valid Solana public key.");
      return;
    }
    setErr("");
    setSaving(true);
    try {
      await patchMerchantProfile(token, {
        name: name.trim(),
        city: city.trim() || "Unknown",
        payoutWallet: payoutWallet.trim(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "save_failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mono-label text-muted-foreground">Loading profile…</div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3">
        <span className="size-2 bg-primary" />
        <h1 className="font-mono uppercase tracking-[0.2em] text-sm">Settings</h1>
      </div>

      <form onSubmit={save} className="mt-8 space-y-5">
        {isOfflineDemoSession() && (
          <div className="mono-label text-warning text-sm border border-warning/40 bg-warning/5 px-3 py-2">
            Sample mode — fields show seeded demo values; saving is disabled.
          </div>
        )}
        {email && (
          <div className="mono-label text-muted-foreground">
            Account email <span className="text-foreground">{email}</span> (change via support in MVP)
          </div>
        )}
        <Field label="Merchant display name" value={name} onChange={setName} />
        <Field label="City" value={city} onChange={setCity} />
        <div>
          <div className="mono-label text-muted-foreground mb-1.5">Solana payout address</div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={payoutWallet}
              onChange={(e) => setPayoutWallet(e.target.value.trim())}
              placeholder="9xQk…"
              spellCheck={false}
              className="flex-1 bg-black border border-hairline px-3 py-3 font-mono text-sm focus:border-primary outline-none"
            />
            <button
              type="button"
              disabled={walletBusy || saving || isOfflineDemoSession()}
              onClick={async () => {
                setErr("");
                setWalletBusy(true);
                try {
                  const addr = await connectInjectedSolanaWallet();
                  setPayoutWallet(addr);
                } catch (e) {
                  setErr(e instanceof Error ? e.message : "wallet_connect_failed");
                } finally {
                  setWalletBusy(false);
                }
              }}
              className="shrink-0 border border-hairline px-4 py-3 mono-label text-primary hover:border-primary hover:bg-primary/5 disabled:opacity-50"
            >
              {walletBusy ? "Connecting…" : "Connect wallet"}
            </button>
          </div>
        </div>

        <div className="border border-warning/40 bg-warning/5 p-4 flex gap-3 text-sm">
          <AlertTriangle size={18} className="text-warning shrink-0 mt-0.5" />
          <div>
            <div className="mono-label text-warning">Public address only</div>
            <div className="text-muted-foreground mt-1">
              Never paste a seed phrase or private key. M.A.X.I.S. is non‑custodial.
            </div>
          </div>
        </div>

        {err && <div className="mono-label text-destructive">{err}</div>}

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={saving || isOfflineDemoSession()}
            className="bg-primary text-primary-foreground px-5 py-3 mono-label disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save to server"}
          </button>
          {saved && <span className="mono-label text-success">✓ Saved</span>}
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <div className="mono-label text-muted-foreground mb-1.5">{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-black border border-hairline px-3 py-2.5 font-mono text-sm focus:border-primary outline-none"
      />
    </label>
  );
}
