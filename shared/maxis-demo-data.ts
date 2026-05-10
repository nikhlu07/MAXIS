/**
 * Single source of demo / mock data for MAXIS.
 *
 * - `maxis-api` Prisma seed reads this → rows land in Postgres (e.g. Supabase).
 * - `maxis-frontend` imports this for copy, placeholders, and offline fallbacks.
 * - Run API against Supabase `DATABASE_URL`, then `npm run db:seed` → UI `GET /merchants/:slug/catalog` matches these values.
 */

export const DEMO_MERCHANT = {
  name: "North Star Cafe",
  slug: "north-star-cafe",
  city: "Bangalore",
  email: "demo@maxis.local",
  /** Demo login only — not a real security boundary in local builds. */
  passwordPlainForDemo: "demo123",
  payoutWallet: "CkkwHhMz3tiRcrdLGBRxLvaHchZqTUEFxNLxUcMzYdRZ",
} as const;

/** Seeded catalog (ids must stay stable — agents & orders reference `itemId`). */
export const DEMO_CATALOG_ITEMS = [
  {
    id: "item_latte_sm",
    name: "Latte Small",
    priceUsd: 4.5,
    available: true,
    category: "Coffee",
  },
  {
    id: "item_cap_md",
    name: "Cappuccino Medium",
    priceUsd: 5.0,
    available: true,
    category: "Coffee",
  },
  {
    id: "item_americano",
    name: "Americano",
    priceUsd: 3.75,
    available: true,
    category: "Coffee",
  },
] as const;

export type DemoCatalogItemUi = {
  id: string;
  name: string;
  usd: number;
  category?: string;
  available: boolean;
};

export function demoCatalogAsUiItems(): DemoCatalogItemUi[] {
  return DEMO_CATALOG_ITEMS.map((row) => ({
    id: row.id,
    name: row.name,
    usd: row.priceUsd,
    category: row.category,
    available: row.available,
  }));
}

/** Pretty JSON for the landing / marketing `<pre>` (subset of catalog). */
export function landingCatalogSnippet(): string {
  return JSON.stringify(
    {
      merchant: DEMO_MERCHANT.slug,
      items: DEMO_CATALOG_ITEMS.slice(0, 2).map((i) => ({
        id: i.id,
        name: i.name,
        usd: i.priceUsd,
      })),
    },
    null,
    2,
  );
}

/** Example body matching `GET /merchants/:slug/catalog` once seeded (`db:seed` → Postgres / Supabase). */
export function apiCatalogExampleJson(): string {
  return JSON.stringify(
    {
      merchant: {
        slug: DEMO_MERCHANT.slug,
        name: DEMO_MERCHANT.name,
        city: DEMO_MERCHANT.city,
      },
      currency: "USD",
      items: DEMO_CATALOG_ITEMS.map((i) => ({
        id: i.id,
        name: i.name,
        usd: i.priceUsd,
        available: i.available,
      })),
    },
    null,
    2,
  );
}
