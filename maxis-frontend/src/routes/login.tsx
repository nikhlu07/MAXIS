import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { HudPanel, SectionLabel } from "@/components/maxis/HudPanel";
import { NavBar } from "@/components/maxis/NavBar";
import { Footer } from "@/components/maxis/Footer";
import { useState } from "react";
import { apiRequest } from "@/lib/api";
import { saveAuth } from "@/lib/auth";

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
  return (
    <div className="min-h-screen flex flex-col bg-black">
      <NavBar />
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <HudPanel className="w-full max-w-md bg-surface-1">
          <SectionLabel>Auth · Demo mode</SectionLabel>
          <h2 className="text-2xl font-semibold mt-3">Sign in</h2>
          <form
            className="mt-6 space-y-4"
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
                setError(err instanceof Error ? err.message : "login_failed");
              } finally {
                setLoading(false);
              }
            }}
          >
            <Field label="Email" type="email" value={email} onChange={setEmail} />
            <Field label="Password" type="password" value={pw} onChange={setPw} />
            {error && <div className="mono-label text-destructive">{error}</div>}
            <button
              disabled={loading}
              className="w-full bg-primary text-primary-foreground py-3 mono-label disabled:opacity-60"
            >
              {loading ? "Logging in..." : "Login ▸"}
            </button>
          </form>
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
