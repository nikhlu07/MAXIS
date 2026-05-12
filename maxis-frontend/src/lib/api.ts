import { DEFAULT_PUBLIC_API_BASE } from "./production-api-default";

function isLoopbackApiOrigin(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
  } catch {
    return false;
  }
}

function resolveApiBase(): string {
  const fromEnv = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "")?.trim();
  // Vercel often has VITE_API_BASE_URL copied from .env.example as http://localhost:3001. That value is
  // baked in at build time and would override a sensible default — browsers then call the visitor's PC, not your API.
  if (fromEnv && !(import.meta.env.PROD && isLoopbackApiOrigin(fromEnv))) {
    return fromEnv;
  }
  if (import.meta.env.PROD) return DEFAULT_PUBLIC_API_BASE.replace(/\/$/, "");
  return "http://localhost:3001";
}

const API_BASE = resolveApiBase();

function explainFetchMisconfig(): string | null {
  if (typeof window === "undefined") return null;
  const pageHttps = window.location.protocol === "https:";
  const base = API_BASE;
  if (pageHttps && (base.startsWith("http://localhost") || base.startsWith("http://127.0.0.1"))) {
    return `This page is HTTPS but VITE_API_BASE_URL points to ${base}. Set it to your public HTTPS API origin and redeploy, or remove it so the production default in src/lib/production-api-default.ts is used.`;
  }
  if (
    pageHttps &&
    base.startsWith("http://") &&
    !base.includes("localhost") &&
    !base.includes("127.0.0.1")
  ) {
    return `Mixed content: the site is HTTPS but VITE_API_BASE_URL is ${base}. Use an https:// API URL and redeploy.`;
  }
  return null;
}

export type ApiError = {
  error: string;
  details?: unknown;
  expected?: string;
  received?: string;
  expectedRecipient?: string;
};

async function parseJsonSafe(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export type ApiHealth = {
  ok?: boolean;
  service?: string;
  database?: "ok" | "error";
  hint?: string;
  onchainPayVerify?: boolean;
};

/** Best-effort; returns null if the API host is unreachable. */
export async function fetchApiHealth(): Promise<ApiHealth | null> {
  try {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) return null;
    return (await res.json()) as ApiHealth;
  } catch {
    return null;
  }
}

export async function apiRequest<T>(
  path: string,
  init?: RequestInit & { token?: string; allowHttpStatuses?: number[] },
): Promise<T> {
  const misconfig = explainFetchMisconfig();
  if (misconfig) {
    throw new Error(misconfig);
  }

  const { token, headers, allowHttpStatuses, ...rest } = init ?? {};
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(headers ?? {}),
      },
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    if (
      m === "Failed to fetch" ||
      m.includes("Load failed") ||
      m.includes("NetworkError") ||
      m.includes("Network request failed")
    ) {
      throw new Error(
        `Cannot reach API at ${API_BASE}. Is the API up? For Vercel, set VITE_API_BASE_URL to your API’s HTTPS origin and redeploy, or update src/lib/production-api-default.ts if you use the built-in production default.`,
      );
    }
    throw e;
  }

  const body = await parseJsonSafe(res);
  if (!res.ok && !(allowHttpStatuses ?? []).includes(res.status)) {
    const err = (body ?? { error: "request_failed" }) as ApiError;
    const message = typeof err.error === "string" ? err.error : "request_failed";
    throw new Error(message);
  }

  return body as T;
}

export { API_BASE };
