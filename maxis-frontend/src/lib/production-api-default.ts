/**
 * When `VITE_API_BASE_URL` is missing in a **production** build (common Vercel mistake),
 * the client would otherwise default to `http://localhost:3001` and every login/register fails.
 *
 * Override: set `VITE_API_BASE_URL` on Vercel (preferred), or change this constant for your fork.
 */
export const DEFAULT_PUBLIC_API_BASE = "https://maxis-k3n8.onrender.com";
