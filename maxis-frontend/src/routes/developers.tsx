import { createFileRoute } from "@tanstack/react-router";
import { NavBar } from "@/components/maxis/NavBar";
import { Footer } from "@/components/maxis/Footer";
import { HudPanel, SectionLabel, Brackets } from "@/components/maxis/HudPanel";
import { apiCatalogExampleJson, DEMO_CATALOG_ITEMS, DEMO_MERCHANT } from "@maxis/demo-data";

export const Route = createFileRoute("/developers")({
  head: () => ({
    meta: [
      { title: "Developers — M.A.X.I.S. Spec" },
      {
        name: "description",
        content:
          "Agent-readable local commerce APIs with x402 checkout and Solana USDC settlement.",
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
          M.A.X.I.S. exposes the local-commerce agent contract: discoverable catalog, deterministic
          order creation, and x402 checkout on Solana.
        </p>

        <Section title="Public catalog route">
          <Code>{`GET /merchants/:slug/catalog
Accept: application/json

200 OK
${apiCatalogExampleJson()}`}</Code>
        </Section>

        <Section title="Order route">
          <Code>{`POST /orders
Content-Type: application/json

{
  "merchantSlug": "${DEMO_MERCHANT.slug}",
  "items": [{ "itemId": "${DEMO_CATALOG_ITEMS[1].id}", "qty": 2 }],
  "fulfillment": { "type": "pickup", "pickupAt": "2026-05-05T18:00:00Z" }
}

201 CREATED
{
  "orderId": "ord_8Hx3...",
  "totalUsd": 11.50,
  "status": "AWAITING_PAYMENT",
  "currency": "USD",
  "fulfillment": { "type": "pickup", "pickupAt": "2026-05-05T18:00:00Z" }
}`}</Code>
        </Section>

        <Section title="Checkout · 402">
          <Code>{`POST /orders/checkout
Content-Type: application/json

{ "orderId": "ord_8Hx3..." }

# Accepted alias: { "order_id": "ord_8Hx3..." }

402 PAYMENT REQUIRED
{
  "error": "payment_required",
  "orderId": "ord_8Hx3...",
  "paymentRequestId": "pr_...",
  "amount": "11.50",
  "currency": "USD",
  "asset": "USDC",
  "chain": "solana-devnet",
  "recipient": "<merchant payoutWallet>",
  "reference": "ord_8Hx3...",
  "expiresAt": "...",
  "anchor": { "...": "on-chain program + escrow hints" }
}`}</Code>
        </Section>

        <Section title="Agent integration · checklist">
          <ul className="space-y-2 text-muted-foreground">
            {[
              "Resolve merchant slug from user intent",
              "Fetch /catalog · cache 60s",
              "Create /orders request for pickup intent",
              "Handle 402 · sign and send USDC tx",
              "Verify tx and poll GET /orders/:id/status until status = READY",
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
