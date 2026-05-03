export function Footer() {
  return (
    <footer className="border-t border-hairline bg-black mt-24">
      <div className="mx-auto max-w-7xl px-6 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mono-label text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="size-2 bg-primary" />
          <span className="text-foreground">M.A.X.I.S.</span>
          <span>· Model-Agnostic eXchange & Inventory Standard</span>
        </div>
        <div className="flex gap-6">
          <a
            href="https://github.com/nikhlu07/MAXIS"
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground"
          >
            GitHub ↗
          </a>
          <span>© {new Date().getFullYear()} M.A.X.I.S.</span>
        </div>
      </div>
    </footer>
  );
}
