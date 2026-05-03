import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/dashboard/settings")({
  head: () => ({ meta: [{ title: "Settings — M.A.X.I.S." }] }),
  component: SettingsPage,
});

const KEY = "maxis_demo_settings_v1";

function SettingsPage() {
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [addr, setAddr] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw);
        setName(s.name || "");
        setCity(s.city || "");
        setAddr(s.addr || "");
      }
    } catch {
      // ignore corrupt localStorage
    }
  }, []);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem(KEY, JSON.stringify({ name, city, addr }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3">
        <span className="size-2 bg-primary" />
        <h1 className="font-mono uppercase tracking-[0.2em] text-sm">Settings</h1>
      </div>

      <form onSubmit={save} className="mt-8 space-y-5">
        <Field label="Merchant display name" value={name} onChange={setName} />
        <Field label="City" value={city} onChange={setCity} />
        <div>
          <div className="mono-label text-muted-foreground mb-1.5">Solana payout address</div>
          <input
            value={addr}
            onChange={(e) => setAddr(e.target.value)}
            placeholder="9xQk...payout"
            className="w-full bg-black border border-hairline px-3 py-3 font-mono text-sm focus:border-primary outline-none"
          />
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

        <div className="flex items-center gap-4">
          <button className="bg-primary text-primary-foreground px-5 py-3 mono-label">Save</button>
          {saved && <span className="mono-label text-success">✓ Saved locally</span>}
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
