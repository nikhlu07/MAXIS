import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X } from "lucide-react";

export function NavBar() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-black/80 backdrop-blur">
      <div className="mx-auto max-w-7xl flex items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-baseline gap-3">
          <span className="font-mono text-primary tracking-[0.2em] text-sm">M.A.X.I.S.</span>
          <span className="hidden sm:inline mono-label text-muted-foreground">Agent Commerce</span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 mono-label">
          <a href="/#pricing" className="text-muted-foreground hover:text-foreground">
            Pricing
          </a>
          <Link to="/developers" className="text-muted-foreground hover:text-foreground">
            Developers
          </Link>
          <Link to="/register" className="text-muted-foreground hover:text-foreground">
            Register
          </Link>
          <Link
            to="/login"
            className="bg-primary text-primary-foreground px-4 py-2 hover:opacity-90"
          >
            Try demo →
          </Link>
        </nav>
        <button
          className="md:hidden text-foreground"
          onClick={() => setOpen(!open)}
          aria-label="Menu"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      {open && (
        <div className="md:hidden border-t border-hairline px-6 py-4 flex flex-col gap-4 mono-label">
          <a href="/#pricing" onClick={() => setOpen(false)}>
            Pricing
          </a>
          <Link to="/developers" onClick={() => setOpen(false)}>
            Developers
          </Link>
          <Link to="/register" onClick={() => setOpen(false)}>
            Register
          </Link>
          <Link
            to="/login"
            onClick={() => setOpen(false)}
            className="bg-primary text-primary-foreground px-4 py-2 inline-block w-fit"
          >
            Try demo →
          </Link>
        </div>
      )}
    </header>
  );
}
