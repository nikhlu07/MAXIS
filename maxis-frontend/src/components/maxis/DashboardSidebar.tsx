import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Menu, X, ListOrdered, BookOpen, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { clearAuth, isOfflineDemoSession } from "@/lib/auth";

const items = [
  { to: "/dashboard/orders", label: "Orders", icon: ListOrdered },
  { to: "/dashboard/catalog", label: "Catalog", icon: BookOpen },
  { to: "/dashboard/settings", label: "Settings", icon: Settings },
] as const;

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const nav = useNavigate();
  const [offlineBanner, setOfflineBanner] = useState(false);

  useEffect(() => {
    setOfflineBanner(isOfflineDemoSession());
  }, [path]);

  return (
    <div className="min-h-screen bg-black flex">
      {/* Mobile bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 flex items-center justify-between px-4 h-12 border-b border-hairline bg-black">
        <Link to="/" className="font-mono text-primary tracking-[0.2em] text-sm">
          M.A.X.I.S.
        </Link>
        <button onClick={() => setOpen(!open)}>
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed md:static z-30 inset-y-0 left-0 w-60 bg-surface-1 border-r border-hairline p-4 transition-transform",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          "pt-16 md:pt-4",
        )}
      >
        <Link to="/" className="hidden md:flex items-baseline gap-2 mb-8">
          <span className="font-mono text-primary tracking-[0.2em] text-sm">M.A.X.I.S.</span>
        </Link>
        <div className="mono-label text-muted-foreground mb-3 flex items-center gap-2">
          <span className="size-1.5 bg-primary" /> Merchant
        </div>
        <nav className="flex flex-col gap-1">
          {items.map(({ to, label, icon: Icon }) => {
            const active = path.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 mono-label border border-transparent",
                  active
                    ? "border-primary text-primary bg-primary/5"
                    : "text-muted-foreground hover:text-foreground hover:border-hairline",
                )}
              >
                <Icon size={14} />
                <span>{label}</span>
              </Link>
            );
          })}
          <button
            onClick={() => {
              clearAuth();
              nav({ to: "/login" });
            }}
            className="flex items-center gap-3 px-3 py-2 mono-label text-muted-foreground hover:text-foreground border border-transparent hover:border-hairline mt-4"
          >
            <LogOut size={14} /> Logout
          </button>
        </nav>
      </aside>
      <main className="flex-1 min-w-0 md:p-8 p-4 pt-16 md:pt-8">
        {offlineBanner && (
          <div className="mb-6 border border-warning/50 bg-warning/10 px-4 py-3 text-sm text-warning">
            <span className="mono-label">Sample mode</span>
            <span className="text-muted-foreground ml-2">
              No API session — fixtures only. Orders / pay flows need a running API + Postgres.
            </span>
            <button
              type="button"
              onClick={() => {
                clearAuth();
                nav({ to: "/login" });
              }}
              className="ml-3 mono-label underline text-foreground hover:text-primary"
            >
              Exit sample mode
            </button>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
