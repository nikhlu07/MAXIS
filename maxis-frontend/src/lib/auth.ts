import { DEMO_MERCHANT } from "@maxis/demo-data";

const TOKEN_KEY = "maxis_auth_token";
const MERCHANT_SLUG_KEY = "maxis_merchant_slug";

/** Sentinel JWT slot: browse dashboard with shared fixtures only (no API writes). */
export const OFFLINE_DEMO_TOKEN = "__maxis_offline_demo__";

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

export function isOfflineDemoSession(): boolean {
  return getAuthToken() === OFFLINE_DEMO_TOKEN;
}

export function enterOfflineDemoMode(): void {
  saveAuth(OFFLINE_DEMO_TOKEN, DEMO_MERCHANT.slug);
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(MERCHANT_SLUG_KEY);
}
