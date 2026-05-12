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

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — M.A.X.I.S." }] }),
  component: LoginPage,
});

function LoginPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
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
          <SectionLabel>Merchant access</SectionLabel>
          <h2 className="text-2xl font-semibold mt-3">Sign in</h2>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            <strong className="text-foreground">Try the product</strong> with one tap — seeded cafe, no shop
            signup. <strong className="text-foreground">Register</strong> only if you want your own merchant row
            (needs API + database running).
          </p>
          {healthDb === "error" && (
            <div className="mt-3 text-xs border border-warning/50 bg-warning/10 text-warning px-3 py-2 rounded mono-label leading-relaxed">
              API reports the database is unreachable (e.g. Supabase paused or bad{" "}
              <code className="text-foreground">DATABASE_URL</code>). Try demo login may fail — use{" "}
              <strong className="text-foreground">sample dashboard</strong> below to explore the UI anyway.
            </div>
          )}
          <button
            type="button"
            disabled={loading}
            onClick={async () => {
              setError("");
              setLoading(true);
              try {
                const { token, merchantSlug } = await loginAsSeededDemo();
                saveAuth(token, merchantSlug);
                nav({ to: "/dashboard/orders" });
              } catch (err) {
                const raw = err instanceof Error ? err.message : "login_failed";
                setError(friendlyApiError(raw));
              } finally {
                setLoading(false);
              }
            }}
            className="w-full mt-5 bg-primary text-primary-foreground py-3 mono-label disabled:opacity-60 hover:opacity-95"
          >
            {loading ? "Opening…" : `Try demo · ${DEMO_MERCHANT.name}`}
          </button>
          <div className="flex items-center gap-3 my-6">
            <div className="h-px flex-1 bg-hairline" />
            <span className="mono-label text-xs text-muted-foreground">or your account</span>
            <div className="h-px flex-1 bg-hairline" />
          </div>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setError("");
              setLoading(true);
              try {
                const data = await apiRequest<{ token: string; merchant: { slug: string } }>(
                  "/auth/login",
                  {
                    method: "POST",
                    body: JSON.stringify({ email, password: pw }),
                  },
                );
                saveAuth(data.token, data.merchant.slug);
                nav({ to: "/dashboard/orders" });
              } catch (err) {
                const raw = err instanceof Error ? err.message : "login_failed";
                setError(friendlyApiError(raw));
              } finally {
                setLoading(false);
              }
            }}
          >
            <Field
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder={DEMO_MERCHANT.email}
            />
            <Field
              label="Password"
              type="password"
              value={pw}
              onChange={setPw}
              placeholder={DEMO_MERCHANT.passwordPlainForDemo}
            />
            {error && <div className="mono-label text-destructive">{error}</div>}
            <button
              disabled={loading}
              className="w-full bg-primary text-primary-foreground py-3 mono-label disabled:opacity-60"
            >
              {loading ? "Logging in..." : "Login ▸"}
            </button>
          </form>
          <p className="mt-4 mono-label text-muted-foreground text-xs">
            Manual login uses the same credentials as the seed:{" "}
            <code className="text-primary">{DEMO_MERCHANT.email}</code> · slug{" "}
            <code className="text-primary">{DEMO_MERCHANT.slug}</code>
          </p>
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              enterOfflineDemoMode();
              nav({ to: "/dashboard/orders" });
            }}
            className="mt-4 w-full border border-hairline py-2.5 mono-label text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 disabled:opacity-50"
          >
            Sample dashboard (no API) — UI + fixtures only
          </button>
          <p className="mt-6 mono-label text-muted-foreground">
            New here?{" "}
            <Link to="/register" className="text-primary">
              Create account →
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
  placeholder,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <div className="mono-label text-muted-foreground mb-1.5">{label}</div>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-black border border-hairline px-3 py-2.5 font-mono text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </label>
  );
}
