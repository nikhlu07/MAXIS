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
import { landingCatalogSnippet } from "@maxis/demo-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "M.A.X.I.S. — Local Commerce for AI Agents" },
      {
        name: "description",
        content:
          "Agent-readable catalog API with x402 checkout on Solana. Local businesses can be discovered, ordered, and paid by AI assistants.",
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
                Local businesses can now sell directly to{" "}
                <span className="text-primary">AI agents</span>. <br />
                M.A.X.I.S. handles catalog, order, and{" "}
                <span className="text-primary">x402 checkout</span>.
              </h1>
              <div className="font-mono text-xs text-muted-foreground tracking-[0.18em]">
                LOCAL COMMERCE · PICKUP FLOW · MACHINE PAYMENTS
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
                #discover · #order · #402 · #pay · #pickup
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
            title="Local business commerce is built for humans"
            body="Agents still scrape pages, miss item context, and fail at checkout. Businesses lose machine-originated demand."
          />
          <FeatCard
            kicker="With M.A.X.I.S."
            title="One contract for discover, order, and pay"
            body="Structured catalogs, deterministic order payloads, and x402 checkout. USDC settles to the merchant wallet on Solana."
          />
        </div>
      </section>

      {/* HOW */}
      <section id="how" className="mx-auto max-w-7xl px-6 py-20 border-t border-hairline">
        <SectionLabel>02 / Pipeline</SectionLabel>
        <h2 className="text-3xl md:text-4xl font-semibold mt-3">
          Four steps. Agent request to pickup.
        </h2>
        <div className="grid md:grid-cols-4 gap-4 mt-10">
          {[
            [
              "01",
              "Publish catalog",
              "Business uploads products in dashboard. MAXIS serves a clean agent-readable catalog.",
            ],
            [
              "02",
              "Create order",
              "Agent submits item + qty + pickup window. MAXIS validates inventory and computes totals.",
            ],
            [
              "03",
              "Return 402",
              "Checkout endpoint responds with HTTP 402 Payment Required and USDC instructions on Solana.",
            ],
            [
              "04",
              "Verify and complete",
              "On-chain payment is verified, merchant marks READY, customer picks up using order code.",
            ],
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
        <SectionLabel>03 / Pricing · Pilot hypothesis</SectionLabel>
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
              <li>— Agent order APIs + 402 checkout</li>
              <li>— Solana mainnet/devnet toggle</li>
              <li>— Wallet-direct settlement</li>
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
              Built for <span className="text-primary">agent execution</span>, not page scraping.
            </h2>
            <p className="text-muted-foreground mt-3">
              Deterministic routes for discover, order creation, payment challenge, and on-chain
              verify.
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
${landingCatalogSnippet()}

POST /orders
→ 201 { "order_id": "ord_8H…", "total_usd": 9.00, "status": "AWAITING_PAYMENT" }

POST /orders/checkout
→ 402 { "asset": "USDC", "chain": "solana",
        "to": "9xQ…", "amount": 9.00 }`}
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
              "M.A.X.I.S. does not custody funds. USDC settles directly to the merchant's Solana wallet.",
            ],
            [
              "Delivery in v1?",
              "Pickup-first in v1. Delivery partner integrations are planned after core ordering + payment flow stabilizes.",
            ],
            [
              "Who can use it?",
              "Any AI assistant or agent that can call MAXIS APIs and handle HTTP 402 payment challenges.",
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
