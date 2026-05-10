import { DEMO_MERCHANT } from "@maxis/demo-data";

const TOKEN_KEY = "maxis_auth_token";
const MERCHANT_SLUG_KEY = "maxis_merchant_slug";

export function saveAuth(token: string, merchantSlug?: string) {
  localStorage.setItem(TOKEN_KEY, token);
  if (merchantSlug) localStorage.setItem(MERCHANT_SLUG_KEY, merchantSlug);
}

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY) ?? "";
}

export function getMerchantSlug() {
  return localStorage.getItem(MERCHANT_SLUG_KEY) ?? DEMO_MERCHANT.slug;
}
