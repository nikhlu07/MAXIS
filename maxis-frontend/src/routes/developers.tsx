import { createFileRoute } from "@tanstack/react-router";
import { NavBar } from "@/components/maxis/NavBar";
import { Footer } from "@/components/maxis/Footer";
import { HudPanel, SectionLabel, Brackets } from "@/components/maxis/HudPanel";

export const Route = createFileRoute("/developers")({
  head: () => ({
    meta: [
      { title: "Developers — M.A.X.I.S. Spec" },
      {
        name: "description",
        content: "Catalog API, quote endpoint and x402 checkout for AI agents.",
      },
    ],
  }),
  component: DevPage,
});

function DevPage() {
  return (
    <div className="bg-black min-h-screen">
      <NavBar />
      <div className="mx-auto max-w-4xl px-6 py-16">
        <SectionLabel>Spec · v0.1 draft</SectionLabel>
        <h1 className="text-4xl md:text-5xl font-semibold mt-3">Developers</h1>
        <p className="text-muted-foreground mt-3 max-w-2xl">
          M.A.X.I.S. exposes three primitives: a canonical catalog, a price quote, and an x402
          checkout. Below is the contract.
        </p>

        <Section title="Public catalog route">
          <Code>{`GET /merchants/:slug/catalog
Accept: application/json

200 OK
{
  "merchant": { "slug": "blue-bottle-mission", "city": "SF" },
  "currency": "USD",
  "items": [
    { "id": "esp_2",  "name": "Espresso",  "usd": 4.25, "available": true },
    { "id": "lat_12", "name": "Latte 12oz", "usd": 5.75, "available": true }
  ]
}`}</Code>
        </Section>

        <Section title="Quote route">
          <Code>{`POST /orders/quote
{
  "merchant": "blue-bottle-mission",
  "items": [{ "id": "lat_12", "qty": 2 }]
}

200 OK
{ "quote_id": "q_8Hx3...", "total_usd": 11.50, "ttl": 60 }`}</Code>
        </Section>

        <Section title="Checkout · 402">
          <Code>{`POST /orders/checkout  { "quote_id": "q_8Hx3..." }

402 PAYMENT REQUIRED
{
  "asset": "USDC",
  "chain": "solana",
  "network": "mainnet",
  "to": "9xQk...payout",
  "amount": 11.50,
  "memo": "q_8Hx3..."
}`}</Code>
        </Section>

        <Section title="Agent integration · checklist">
          <ul className="space-y-2 text-muted-foreground">
            {[
              "Resolve merchant slug from user intent",
              "Fetch /catalog · cache 60s",
              "Build quote request · respect ttl",
              "Handle 402 · sign + send USDC tx",
              "Poll /orders/:id until status = PAID",
            ].map((x) => (
              <li key={x} className="flex gap-3">
                <span className="text-primary font-mono">▸</span>
                <span>{x}</span>
              </li>
            ))}
          </ul>
        </Section>

        <HudPanel className="mt-12 bg-surface-1">
          <div className="mono-label text-muted-foreground">Repository</div>
          <a
            href="https://github.com/nikhlu07/MAXIS"
            target="_blank"
            rel="noreferrer"
            className="text-primary mt-2 inline-block"
          >
            github.com/nikhlu07/MAXIS ↗
          </a>
        </HudPanel>
      </div>
      <Footer />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-12">
      <h2 className="font-mono uppercase tracking-[0.16em] text-sm text-primary mb-3">{title}</h2>
      {children}
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <Brackets />
      <pre className="border border-hairline bg-surface-1 p-5 text-xs font-mono overflow-x-auto whitespace-pre">
        {children}
      </pre>
    </div>
  );
}
