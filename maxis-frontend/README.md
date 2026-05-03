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

Cloudflare Workers deploy uses `wrangler.jsonc` and the same build output under `dist/`.
