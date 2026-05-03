# M.A.X.I.S. frontend

Vite + TanStack Start app for the merchant dashboard and marketing shell.

## Docs

Product requirements, API contracts, and UX depth live in **[FRONTEND-SPEC.md](./FRONTEND-SPEC.md)** (the long-form spec).

## Setup

```bash
cp .env.local.example .env.local   # optional
npm install
npm run dev
```

Open the URL printed in the terminal (default dev port comes from the TanStack / Vite stack).

## Build

```bash
npm run build
npm run preview
```

The production build uses [Nitro](https://nitro.build/) with the **`vercel` preset**, which writes **`.vercel/output`**. [Vercel’s TanStack Start guide](https://vercel.com/docs/frameworks/full-stack/tanstack-start) expects that layout so the platform can run SSR and static assets. If the project was previously built for **Cloudflare Workers** (Lovable’s default), deploying the same bundle to Vercel produced **404 / NOT_FOUND** because Workers output is not a valid Vercel deployment.

**Vercel project settings (typical):**

- **Root directory:** `maxis-frontend` if the repo root is the monorepo; otherwise the app root.
- **Install command:** `npm install` (or `npm ci`).
- **Build command:** `npm run build`.
- **Output directory:** leave **empty** — do not set `dist` or `public`; Nitro + Vercel use `.vercel/output` automatically when the build runs on Vercel.

`wrangler.jsonc` is only for optional **Cloudflare** deploys, not for Vercel.
