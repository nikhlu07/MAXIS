const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ??
  "http://localhost:3001";

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

export async function apiRequest<T>(
  path: string,
  init?: RequestInit & { token?: string; allowHttpStatuses?: number[] },
): Promise<T> {
  const { token, headers, allowHttpStatuses, ...rest } = init ?? {};
  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers ?? {}),
    },
  });

  const body = await parseJsonSafe(res);
  if (!res.ok && !(allowHttpStatuses ?? []).includes(res.status)) {
    const err = (body ?? { error: "request_failed" }) as ApiError;
    const message = typeof err.error === "string" ? err.error : "request_failed";
    throw new Error(message);
  }

  return body as T;
}

export { API_BASE };
