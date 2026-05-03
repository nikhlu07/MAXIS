import { createFileRoute, Link } from "@tanstack/react-router";
import { NavBar } from "@/components/maxis/NavBar";
import { Footer } from "@/components/maxis/Footer";
import { HudPanel, Brackets, SectionLabel } from "@/components/maxis/HudPanel";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "M.A.X.I.S. — Agent Commerce Standard for Cafés" },
      {
        name: "description",
        content:
          "Canonical catalog API + verified x402 USDC checkout on Solana. SMB merchants, non-custodial payouts.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="bg-black text-foreground">
      <NavBar />
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 hud-grid opacity-40 pointer-events-none" />
        <div className="mx-auto max-w-7xl px-6 py-20 md:py-28 relative">
          <HudPanel className="md:p-12 p-6 bg-surface-1/60">
            <div className="max-w-3xl space-y-6">
              <SectionLabel>Agent Commerce · Solana · x402</SectionLabel>
              <h1 className="text-4xl md:text-6xl font-semibold leading-[1.05] tracking-tight">
                Human menus don't speak to <span className="text-primary">agents</span>. <br />
                M.A.X.I.S. gives every café a machine‑readable{" "}
                <span className="text-primary">contract</span>.
              </h1>
              <div className="font-mono text-xs text-muted-foreground tracking-[0.18em]">
                CAFÉS · QSR · MERCHANT‑UPLOAD CATALOG · V1
              </div>
              <div className="flex flex-wrap gap-3 pt-2">
                <Link
                  to="/register"
                  className="bg-primary text-primary-foreground px-5 py-3 mono-label hover:opacity-90"
                >
                  Get started ▸
                </Link>
                <Link
                  to="/developers"
                  className="border border-primary text-primary px-5 py-3 mono-label hover:bg-primary/10"
                >
                  Read the spec →
                </Link>
              </div>
              <div className="font-mono text-xs text-muted-foreground pt-4">
                #catalog · #quote · #402 · #verify · #fulfil
              </div>
            </div>
          </HudPanel>
          <div className="mt-10 flex flex-wrap items-center gap-x-10 gap-y-3 mono-label text-muted-foreground">
            <span>Backed by workflows</span>
            <span className="size-1 bg-muted-foreground rounded-full" />
            <span>Hackathon‑ready</span>
            <span className="size-1 bg-muted-foreground rounded-full" />
            <span>Non‑custodial payouts</span>
          </div>
        </div>
      </section>

      {/* PROBLEM / SOLUTION */}
      <section id="problem" className="mx-auto max-w-7xl px-6 py-20">
        <SectionLabel>01 / Problem · Solution</SectionLabel>
        <div className="grid md:grid-cols-2 gap-6 mt-6">
          <FeatCard
            kicker="Today"
            title="Human sites ≠ machine contracts"
            body="Agents scrape PDFs, guess prices, fail at checkout. Cafés lose orders to brittle parsing and zero payment trust."
          />
          <FeatCard
            kicker="With M.A.X.I.S."
            title="Canonical catalog + verified pay"
            body="One JSON schema. One quote endpoint. One x402 challenge. USDC settles to the merchant's own Solana wallet."
          />
        </div>
      </section>

      {/* HOW */}
      <section id="how" className="mx-auto max-w-7xl px-6 py-20 border-t border-hairline">
        <SectionLabel>02 / Pipeline</SectionLabel>
        <h2 className="text-3xl md:text-4xl font-semibold mt-3">Four steps. Catalog to fulfil.</h2>
        <div className="grid md:grid-cols-4 gap-4 mt-10">
          {[
            [
              "01",
              "Catalog publish",
              "Merchant uploads items via dashboard or CSV. Served as canonical JSON.",
            ],
            ["02", "Quote lock", "Agent calls /orders/quote. Price + tax + ETA pinned for 60s."],
            [
              "03",
              "Checkout 402",
              "HTTP 402 challenge returns USDC payment instructions on Solana.",
            ],
            ["04", "Verify · Fulfill", "Tx confirmed on‑chain. Merchant sees PAID. Tap to fulfil."],
          ].map(([n, t, b]) => (
            <HudPanel key={n} className="bg-surface-1" brackets={false}>
              <div className="font-mono text-primary text-sm tracking-[0.2em]">{n}</div>
              <div className="text-lg font-semibold mt-3">{t}</div>
              <div className="text-sm text-muted-foreground mt-2">{b}</div>
            </HudPanel>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="mx-auto max-w-7xl px-6 py-20 border-t border-hairline">
        <SectionLabel>03 / Pricing · Hackathon hypothesis</SectionLabel>
        <div className="mt-6 max-w-md">
          <HudPanel className="bg-surface-2">
            <div className="mono-label text-muted-foreground">Pilot tier</div>
            <div className="flex items-baseline gap-2 mt-3">
              <span className="text-5xl font-semibold">$29</span>
              <span className="text-muted-foreground">/ mo</span>
            </div>
            <div className="font-mono text-sm text-primary mt-1">+ $0.15 / order</div>
            <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
              <li>— Hosted catalog endpoint</li>
              <li>— Quote + 402 checkout</li>
              <li>— Solana mainnet/devnet toggle</li>
              <li>— Non‑custodial payout</li>
            </ul>
            <Link
              to="/register"
              className="mt-6 block text-center bg-primary text-primary-foreground px-5 py-3 mono-label"
            >
              Start pilot ▸
            </Link>
            <div className="mono-label text-muted-foreground mt-4">Draft · subject to change</div>
          </HudPanel>
        </div>
      </section>

      {/* DEV TEASER */}
      <section className="mx-auto max-w-7xl px-6 py-20 border-t border-hairline">
        <SectionLabel>04 / Developers</SectionLabel>
        <div className="grid md:grid-cols-2 gap-8 mt-6 items-start">
          <div>
            <h2 className="text-3xl font-semibold">
              Built for <span className="text-primary">agents</span>, not browsers.
            </h2>
            <p className="text-muted-foreground mt-3">
              A predictable surface. Deterministic responses. No DOM scraping.
            </p>
            <Link
              to="/developers"
              className="inline-block mt-6 border border-primary text-primary px-5 py-3 mono-label hover:bg-primary/10"
            >
              Open the spec →
            </Link>
          </div>
          <div className="relative">
            <Brackets />
            <pre className="border border-hairline bg-surface-1 p-5 text-xs font-mono overflow-x-auto">
              {`GET  /merchants/:slug/catalog
{
  "merchant": "blue-bottle-mission",
  "items": [
    { "id": "esp_2", "name": "Espresso", "usd": 4.25 },
    { "id": "lat_12", "name": "Latte 12oz", "usd": 5.75 }
  ]
}

POST /orders/quote
→ 200 { "quote_id": "q_8H…", "total_usd": 10.00, "ttl": 60 }

POST /orders/checkout
→ 402 { "asset": "USDC", "chain": "solana",
        "to": "9xQ…", "amount": 10.00 }`}
            </pre>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-6 py-20 border-t border-hairline">
        <SectionLabel>05 / FAQ</SectionLabel>
        <Accordion type="single" collapsible className="mt-6">
          {[
            [
              "Custody?",
              "M.A.X.I.S. never holds funds. USDC settles directly to the merchant's Solana wallet address.",
            ],
            [
              "v1 ingestion?",
              "Manual entry + CSV upload. Auto‑sync to Square/Toast on the roadmap.",
            ],
            [
              "Mainnet or devnet?",
              "Both. Toggle per merchant in Settings. Devnet recommended for hackathon demos.",
            ],
          ].map(([q, a]) => (
            <AccordionItem key={q} value={q} className="border-hairline">
              <AccordionTrigger className="font-mono uppercase tracking-[0.12em] text-sm">
                {q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <Footer />
    </div>
  );
}

function FeatCard({ kicker, title, body }: { kicker: string; title: string; body: string }) {
  return (
    <HudPanel className="bg-surface-1">
      <div className="mono-label text-primary">{kicker}</div>
      <div className="text-xl font-semibold mt-3">{title}</div>
      <div className="text-sm text-muted-foreground mt-3">{body}</div>
    </HudPanel>
  );
}
