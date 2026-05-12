import { DEMO_MERCHANT } from "@maxis/demo-data";
import { apiRequest } from "@/lib/api";

/** Logs in as the seeded playground merchant (same credentials as `npm run db:seed`). Requires API + Postgres. */
export async function loginAsSeededDemo(): Promise<{ token: string; merchantSlug: string }> {
  const data = await apiRequest<{ token: string; merchant: { slug: string } }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: DEMO_MERCHANT.email,
      password: DEMO_MERCHANT.passwordPlainForDemo,
    }),
  });
  return { token: data.token, merchantSlug: data.merchant.slug };
}
