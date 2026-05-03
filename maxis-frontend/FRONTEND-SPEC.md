# M.A.X.I.S. · Frontend (`maxis-frontend`)

### Merchant dashboard & marketing shell for **M.A.X.I.S.**

**Full name:** **M**odel-**A**gnostic **eX**change **&** **I**nventory **S**tandard

[![Repo](https://img.shields.io/badge/repo-M.A.X.I.S-181717?style=flat-square&logo=github)](https://github.com/nikhlu07/MAXIS)
[![Root README](https://img.shields.io/badge/docs-root%20README-blue?style=flat-square)](https://github.com/nikhlu07/MAXIS#readme)

This folder (`maxis-frontend/`) documents **everything rendered in the browser for merchants** — not RPC, not webhooks, not x402 internals. It lives inside the monorepo **[nikhlu07/MAXIS](https://github.com/nikhlu07/MAXIS)** next to the root product README.

---

## Table of contents

1. [Mission & boundaries](#1-mission--boundaries-what-this-repo-is-not)  
2. [Personas & jobs-to-be-done](#2-personas--jobs-to-be-done)  
3. [Reference architecture (browser only)](#3-reference-architecture-browser-only)  
4. [Tech stack recommendation](#4-tech-stack-recommendation)  
5. [Repository layout suggestion](#5-repository-layout-suggestion)  
6. [Routes, navigation & layout](#6-routes-navigation--layout)  
7. [Screens — detailed UX & acceptance criteria](#7-screens--detailed-ux--acceptance-criteria)  
8. [Authentication & session](#8-authentication--session)  
9. [HTTP client guidelines](#9-http-client-guidelines)  
10. [API integration — exhaustive contract](#10-api-integration--exhaustive-contract)  
11. [Response normalization](#11-response-normalization)  
12. [Realtime updates (orders)](#12-realtime-updates-orders)  
13. [Error handling matrix](#13-error-handling-matrix)  
14. [Accessibility & responsive](#14-accessibility--responsive)  
15. [Security notes (frontend-facing)](#15-security-notes-frontend-facing)  
16. [Performance](#16-performance)  
17. [Environment matrix](#17-environment-matrix)  
18. [CORS & cookies](#18-cors--cookies)  
19. [Deploy (Vercel) — step-by-step](#19-deploy-vercel--step-by-step)  
20. [CI/CD suggestions](#20-cicd-suggestions)  
21. [Testing suggestions](#21-testing-suggestions)  
22. [Coordination checklist with backend](#22-coordination-checklist-with-backend)  
23. [Definition of Done](#23-definition-of-done-expanded)  
24. [Onboarding checklist (new frontend dev / freelancer)](#24-onboarding-checklist-new-frontend-dev--freelancer)  
25. [Troubleshooting](#25-troubleshooting)  
26. [Changelog conventions](#26-changelog-conventions)  
27. [Licence](#27-licence)  
28. [Glossary](#28-glossary)  

---

## 1. Mission & boundaries ("what this repo is **not**")

### In scope — **merchant web**

- **Landing / marketing**: explain wedge (cafés, SMB catalogs), positioning vs “scrape any website”.
- **Onboarding UX**: merchant email/password, optional shop slug + city display.
- **Catalog management**: deterministic menu rows (SKU-like items): name, price, availability, optional category & image URL.
- **Order operations**: observe **pending / paid / fulfilled / cancelled**, expand line items, mark **fulfilled** when business rules say so.
- **Settings**: payout **Solana public address** (+ profile fields mirrored from backend).

### Hard out of scope — **never in this codebase**

| Concern | Why | Where it lives |
|--------|-----|----------------|
| SPL / USDC transaction building | Secrets + chain logic | **`maxis-api`** + agent/script |
| x402 handshake & HTTP 402 body design | Payment protocol contract | **`maxis-api`** |
| Transaction verification vs RPC | Consensus truth | **`maxis-api`** |
| Helius webhooks ingestion | Integrity + idempotency | **`maxis-api`** |
| Postgres / Prisma / migrations | Persistence | **`maxis-api`** |
| Indexing Anchor events | Blockchain program integration | **`maxis-anchor`** *(if used)* |

The frontend trusts **authenticated JSON** over HTTPS. Anything that validates money moved on-chain stays server-side.

---

## 2. Personas & jobs-to-be-done

### Merchant owner (café manager)

**Jobs:**

1. “I pasted my payout wallet once and never leaked a private key.”  
2. “I fixed a wrong price — agents see updated numbers next quote.”  
3. “Someone paid via agent — I hear a ding metaphorically (`PAID`), I mark made when ready.”  

**Non-goals for v1:** accounting export, Stripe, tipping, Uber Eats ingestion.

### You (engineering)

**Jobs:**

1. One **environment variable** for API base (`NEXT_PUBLIC_*`).  
2. **Zero coupling** to Mainnet/Devnet specifics in UI strings except labels you choose (“Devnet demo”).  
3. **Graceful degradation** when API is rebooting (readable error, retry).

---

## 3. Reference architecture (browser only)

Conceptual layering — language-agnostic:

```
┌─────────────────────────────────────────┐
│              Pages / Routes              │  Landing, Auth, Dashboard
├─────────────────────────────────────────┤
│     Layout shells (marketing vs app)      │  Nav, redirects, suspense
├─────────────────────────────────────────┤
│  Feature modules (orders, catalog, etc.) │  Tables, forms, modals
├─────────────────────────────────────────┤
│        API façade (single module)         │  Fetch + auth headers + normalize
├─────────────────────────────────────────┤
│   Session adapter (memory / storage cookie) │
└─────────────────────────────────────────┘
                      │
                      │ HTTPS JSON
                      ▼
              ┌──────────────┐
              │   maxis-api   │
              └──────────────┘
```

**Golden rule:** *one* module knows `NEXT_PUBLIC_API_URL`; pages import typed functions, not scattered `fetch` strings.

---

## 4. Tech stack recommendation

| Layer | Recommendation | Reason |
|-------|----------------|--------|
| Framework | **Next.js 14+** App Router | Best Vercel story, SSR/SSG for landing. |
| Language | **TypeScript** strict | Contracts with backend stay honest. |
| Styling | **Tailwind CSS** | Fast iteration without design system debt. |
| Forms | React Hook Form + **Zod** | Client validation mirrored to backend Zod/OpenAPI eventually. |
| Data | **TanStack Query** or **SWR** | Dedup + refetch for orders polling. |

You may diverge — if you do, edit this table in the same merge request so the README stays truthful.

---

## 5. Repository layout suggestion

Not mandatory — illustrative for Next App Router:

```
app/
  (marketing)/layout.tsx       # minimal chrome + footer links
  (marketing)/page.tsx        # /
  login/page.tsx
  register/page.tsx
  dashboard/layout.tsx       # authenticated shell + sidebar
  dashboard/page.tsx          # redirect -> /dashboard/orders
  dashboard/orders/page.tsx
  dashboard/catalog/page.tsx
  dashboard/settings/page.tsx
components/
  ui/                         # button, input, badge, skeleton
  charts/                     # omit until needed
lib/
  api/
    client.ts                 # thin fetch wrapper
    normalize.ts             # coerce {orders} vs [...]
    types.ts                  # Merchant, OrderSummary, CatalogItem …
hooks/
  useSession.ts               # auth token read/write abstraction
.env.local.example
```

---

## 6. Routes, navigation & layout

| Path | Visibility | Behaviour |
|------|-------------|-----------|
| `/` | Public | Explain product; Login / Sign up CTAs |
| `/login` | Public | Redirect to `/dashboard/orders` if already authenticated |
| `/register` | Public | Same post-success redirect |
| `/dashboard/*` | Auth required | Sidebar: Orders · Catalog · Settings · Log out |
| `/dashboard` | Redirect | → `/dashboard/orders` |

**Deep-linking:** if user bookmarks `/dashboard/catalog` unauthenticated → send to `/login?next=/dashboard/catalog`.

---

## 7. Screens — detailed UX & acceptance criteria

### 7.1 Landing `/`

**Content blueprint**

- **Headline**: M.A.X.I.S. + subtitle (SMB catalog × AI commerce × verified USDC).  
- **3 bullets**: canonical menu; agent quotes + pay; payout to merchant wallet.  
- **Honest caveat**: merchant-uploaded catalog **v1** (no “magic scrape any Instagram” headline).  
- **CTAs**: Primary “Create account”; secondary “Sign in”.  
- **Footer links**: GitHub org, backend repo, Discord/Telegram/X if exists.

**Acceptance**

- Lighthouse **Performance** sane on 3G throttled laptop (defer heavy images).  
- No CLS on font swap (optional `display:swap` fonts).  

---

### 7.2 Register `/register`

**Fields** (recommended)

| Field | Validation | Backend note |
|-------|-------------|--------------|
| Shop display name | 2–80 chars | May map `name` |
| Email | RFC-ish regex + trim | Lowercase normalization optional |
| Password | ≥ 8 chars, upper+lower+digit suggestion | Complexity rule follow backend exactly |
| Confirm password | must match client-side | —
| Shop slug *(optional manual)* | `^[a-z0-9]+(?:-[a-z0-9]+)*$` | If omitted, backend may slugify |

**Flows**

1. Submit → spinner →  
   success: persist session → redirect `/dashboard/catalog` *or* `/dashboard/orders` (pick one UX story).  
2. Duplicate email (`409`): inline error.  

**Accessibility**

- `aria-invalid`, `aria-describedby` for errors; focus management on submit fail.

---

### 7.3 Login `/login`

Same pattern as register; success redirect default `/dashboard/orders`.

**Threat UX**

Optional link “Wrong environment?” if `NEXT_PUBLIC_API_URL` points to prod inadvertently during local dev.

---

### 7.4 Orders `/dashboard/orders`

**Objective:** zero missed **PAID** transitions during demo fatigue.

**Table columns**

- Short **order ID** (`…last6` tooltip full id) — copy button optional.  
- **Created** localized timestamp (ISO from API parsed with `Intl.DateTimeFormat`).  
- **Total** USD — canonical **formatUsd** helper.  
- **Status badge** — color map: Pending amber, Paid green, Fulfilled grey, Cancelled red.  

**Interactions**

1. Expand row ⇒ line items grouped (name × qty × unit price snapshot).  
2. If **`PAID`**, expose **Fulfill order** (`PATCH` documented below). Disabled if already terminal.  

**Realtime**

Poll every **4000 ms** while tab focuses; backoff to **12000 ms** if tab blurred (battery).  

**States**

| State | UX |
|-------|-----|
| Initial load | Skeleton rows |
| Empty | Gentle copy + bullet “Ask teammate to trigger demo agent” |
| Loading error | Retry CTA hitting SWR/query `mutate()` |
| 401 | Immediate logout toast + redirect `/login` |

---

### 7.5 Catalog `/dashboard/catalog`

**Grid / table semantics**

Editable fields per row inline or modal-driven — pick one pattern for fewer bug surfaces.

Suggested columns:

| Column | Constraints |
|--------|---------------|
| Name | required ≤120 chars |
| Category | optional ≤48 |
| USD price | `^\\d+(\\.\\d{1,2})?$`, > 0 |
| Available | checkbox — agents must filter false server-side ideally |
| Image URL | optional URL |
| Actions | Duplicate row (nice), Delete confirm |

**Save model**

Prefer **autosave debounced** vs single **Save Catalog** sticky footer — MVP often easier with explicit **Save** + toast.

---

### 7.6 Settings `/dashboard/settings`

| Field | Help text |
|-------|-----------|
| `solanaAddress` | Paste **Phantom public** / hardware wallet pubkey only. Warn: NEVER seed phrase. |

**Pseudo-validation**

- Length 32–44 base58 heuristic — still accept if backend rejects with explicit error.

---

### 7.7 Optional Demo `/dashboard/demo` *(judges)*

If agent cannot realistically run wallet in-browser, embed **hosted video** iframe or link out — avoids fake “simulate pay” hacks.

---

## 8. Authentication & session

### Recommended MVP paths

**A — Bearer + `sessionStorage`**

Pros: simplest.  

Cons: XSS theoretically token theft — mitigate CSP headers at edge + avoid `dangerouslySetInnerHTML`.

**B — HTTP-only cookie set by backend**

Pros: hardened token exposure.  

Cons: Needs `credentials: 'include'` + correct CORS + CSRF mitigation from backend (`SameSite=Lax`, CSRF tokens on mutating verbs).  

Coordinate with **`maxis-api`** — document final choice once.

### Logout semantics

Always clear UI state + optionally call `POST /auth/logout` if backend rotates refresh tokens someday.

---

## 9. HTTP client guidelines

### Single entry `apiClient`

Pseudo-type:

```
apiClient<Response>(path: string, init?: FetchInit): Promise<Response>
```

**Responsibilities**

1. Prefix `NEXT_PUBLIC_API_URL`.  
2. Inject `Authorization` when authenticated.  
3. Parse JSON → typed result.  
4. Map HTTP errors (`400`, `401`, `409`, `429`, `5xx`).  
5. Throw domain error object `{status, body, message}` for UI layering.

### Idempotency (future)

Mutation headers `Idempotency-Key` for double clicks — negotiate with backend later.

---

## 10. API integration — exhaustive contract

> **Disclaimer:** Paths here are canonical **targets** aligned with the root README in [`nikhlu07/MAXIS`](https://github.com/nikhlu07/MAXIS). If **`maxis-api`** diverges, **mirror reality in README** in lockstep merges.

---

### 10.1 Base URL rules

Assume `NEXT_PUBLIC_API_URL=http://localhost:3001/api` includes `/api` prefix. Compose:

```
full(path) -> `${BASE}${path}`
```

Trailing slash tolerant on builder side.

---

### 10.2 `POST /auth/register`

**Request JSON**

```json
{
  "email": "owner@café.example",
  "password": "••••••••",
  "name": "Morning Owl Coffee",
  "slug": "morning-owl-coffee",
  "city": "Bengaluru"
}
```

**Success (200/201 hypothetical)**

```json
{
  "token": "jwt-here…",
  "merchant": {
    "id": "mer_xxx",
    "name": "Morning Owl Coffee",
    "email": "owner@café.example",
    "slug": "morning-owl-coffee",
    "solanaAddress": null,
    "city": "Bengaluru"
  }
}
```

**Errors**

| Code | Typical cause | Frontend |
|------|---------------|----------|
| 400 | schema fail | Inline field validation |
| 409 | slug/email conflict | suggest alternate slug |

---

### 10.3 `POST /auth/login`

**Request**

```json
{ "email": "...", "password": "..." }
```

Same success envelope as register.

Errors: `401` invalid credentials toast.

---

### 10.4 `GET /dashboard/orders` — authenticated

Possible shapes — normalize aggressively:

Variant A wrapper:

```json
{
  "orders": [{ "...": "" }],
  "total": 27,
  "hasMore": false
}
```

Variant B raw array (legacy):

```json
[{ "...": "" }]
```

**Order item fields (minimum)**

```json
{
  "id": "ord_xyz",
  "totalUsd": "11.75",
  "status": "PAID",
  "createdAt": "2026-05-01T10:03:42.000Z",
  "agentUserId": "agent_demo_001",
  "items": [
    { "name": "Latte", "quantity": 2, "priceUsd": "4.50" }
  ]
}
```

---

### 10.5 `PATCH /dashboard/orders/:orderId/status`

**Request**

```json
{ "status": "FULFILLED" }
```

**Success**: updated order or `{ ok: true }` — unify via normalizer mapping.

Forbidden transitions should return `400`; surface inline.

---

### 10.6 `GET /dashboard/catalog`

If missing **404**, treat as empty array after backend alignment.

Representative payload:

```json
{
  "items": [
    {
      "id": "cit_aaa",
      "name": "Oat Milk Latte",
      "priceUsd": "5.75",
      "category": "Coffee",
      "available": true,
      "imageUrl": null
    }
  ]
}
```

---

### 10.7 `POST /dashboard/catalog`

**Request**

```json
{
  "items": [
    {
      "id": "cit_aaa",
      "name": "Oat Milk Latte",
      "priceUsd": "5.75",
      "category": "Coffee",
      "available": true,
      "imageUrl": ""
    },
    {
      "name": "Espresso Shot",
      "priceUsd": "3.50",
      "category": "Coffee",
      "available": true
    }
  ]
}
```

Interpretation conventions:

| `id` | Meaning |
|------|---------|
| Absent/null | CREATE |
| Existing | REPLACE / UPSERT |

**Response variants**

Ideal:

```json
{ "created": 1, "updated": 1, "items": […] }
```

---

### 10.8 `GET /dashboard/me`

```json
{
  "id": "mer_xxx",
  "name": "...",
  "email": "...",
  "slug": "...",
  "solanaAddress": "8nv…",
  "city": "Mumbai"
}
```

---

### 10.9 `PATCH /dashboard/me`

```json
{ "solanaAddress": "8nv…xyz", "name": "New Signage Legal Name" }
```

---

## 11. Response normalization

Implement `normalizeOrdersResponse(input:unknown): NormalizedEnvelope`.

Unit tests advisable for:

```
{ orders: [...] }, { data:[...]}, raw array
```

Similarly `normalizeCatalogResponse`.

Never scatter `?.orders ?? data` duplication — future bug farm.

---

## 12. Realtime updates (orders)

| Technique | Complexity | Recommendation |
|-----------|-------------|----------------|
| **Polling interval** | low | ✅ MVP hackathon-proof |
| **SSE** (`EventSource`) | medium | Negotiate `/events` someday |
| **WebSocket** | high | Rarely warranted early |

 backoff rules if >5 consecutive failures.

---

## 13. Error handling matrix

| HTTP | Merchant messaging | Telemetry |
|------|--------------------|-----------|
| 401 | Silent logout toast | WARN |
| 403 | “No permission contact admin” | ERROR |
| 404 | Retry + escalate | ERROR |
| 409 slug | Field highlight | WARN |
| 429 | countdown retry | WARN |
| 502/504 | degraded banner persistent | CRITICAL toast |

Expose **Correlation-Id** if backend echoes `x-request-id` header for support triage logs.

---

## 14. Accessibility & responsive

Minimal standard:

WCAG-ish:

- Buttons + links keyboard reachable.  
- Form errors programmatically tied via `aria-describedby`.

Responsive:

Sidebar collapses to **hamburger** under `lg` breakpoint; tables convert to stacked cards optionally.

---

## 15. Security notes (frontend-facing)

| Risk | Mitigation |
|------|------------|
| Token leak via XSS | CSP (script-src restrictive), sanitise dangerously HTML |
| Open redirect `/login?next=` | Allowlist prefixes `/dashboard/` only |
| Accidental staging API in prod screenshot | watermark dev banner when API host mismatches heuristic |

Merchant education copy on settings page about **never** pasting mnemonic.

---

## 16. Performance

- Code-split dashboards heavy charts (future).  
- Image optimisation via `next/image` if menus show remote pictures.  

---

## 17. Environment matrix

| Env | `NEXT_PUBLIC_API_URL` typical value |
|-----|--------------------------------------|
| local | `http://localhost:3001/api` |
| staging | `https://api-staging.your-domain.com/api` |
| prod | `https://api.your-domain.com/api` |

Document **staging** prominently for hack judges.

---

## 18. CORS & cookies

If Bearer only: **`Access-Control-Allow-Origin`** must whitelist Vercel domain.

If cookie session: **`Access-Control-Allow-Credentials: true`** + non-wildcard origin.

Handshake list with backend README.

---

## 19. Deploy (Vercel) — step-by-step

1. **Import repo** → pick team.
2. **Framework preset** Next.js.
3. **Env var** configure `NEXT_PUBLIC_API_URL`.
4. **Production branch** protection `main`.
5. Preview deployments sanity: open preview URL `/login` verifying correct API accidentally not prod if dangerous.
6. **Custom domain optional** apex + apex redirect apex→www canonical.

Smoke:

```
/register flow
/login flow
/catalog save reload
simulate paid order externally then refresh orders
logout
```

---

## 20. CI/CD suggestions

GitHub Actions:

| Job | Goal |
|-----|------|
| `lint` | `pnpm lint` / `pnpm eslint` |
| `typecheck` | `pnpm tsc --noEmit` |
| `build` | `pnpm build` |

Protect `main` via required checks once stable.

---

## 21. Testing suggestions

| Layer | Tooling |
|-------|---------|
| Unit | Vitest jest-like |
| Component | RTL |
| E2E | Playwright staging happy path flows |

Bare minimum MVP: playwright **login smoke** nightly.

---

## 22. Coordination checklist with backend

Weekly async doc comment / sync:

| Question | Resolved when |
|-----------|---------------|
| Exact register JSON success code | pasted sample |
| Slug uniqueness error structure | pasted sample |
| Order list wrapper shape frozen | openapi commit |
| Order fulfill forbidden paths | enumerated |
| Does catalog delete exist | decide strategy |
| `correlation-id` propagation | middleware agreement |

Maintain **pinned OpenAPI** JSON URL in README future section.

---

## 23. Definition of Done — expanded

- [ ] All screens above implemented or intentionally deferred tracked in issues.  
- [ ] Unified API client implemented with tests for normalizers OR snapshot tested.  
- [ ] Authenticated redirects correct + `next` redirect param safe-list.  
- [ ] Orders auto-refresh under focus w/ backoff.  
- [ ] Catalog survives hard reload verifying server authoritative.  
- [ ] Solana pubkey field education copy present.  
- [ ] Accessible forms baseline.  
- [ ] Lint + build green in CI.  
- [ ] Staging deployed + smoke script recorded (loom optional).  

---

## 24. Onboarding checklist (new frontend dev / freelancer)

1. Pull repo · install deps (`pnpm i` / policy).  
2. Copy `.env.local.example`.  
3. Hit health check `GET `${API}/health` if exists else login attempt.  
4. Read **§10 integration** canonical vs actual divergence doc from backend Slack pin.  
5. Pick Issue tagged `frontend-good-first-issue`.  

---

## 25. Troubleshooting

| Symptom | Cause | Mitigation |
|---------|-------|-------------|
| CORS opaque TypeError fetch | Backend missing ACAO | whitelist origin |
| 401 cascade infinite loop | interceptor double redirect guard | latch flag once |
| Slug collisions during demo | scripted parallel register | backoff retry UI |
| Times wrong | Parsing ISO wrongly | unify `new Date(ts)` sanity locale |

---

## 26. Changelog conventions

Use **Keep a Changelog** headings in root `CHANGELOG.md` once code appears — start at `0.1.0` first UI alpha.

Semantic versioning independent of hackathon demos until product GA.

---

## 27. Licence

Set org-wide default (MIT preferred by many OSS judges) via org policy file.

---

## 28. Glossary

| Term | Meaning |
|------|---------|
| **Agent** | Autonomous shopper calling HTTP + paying on-chain externally |
| **x402** | HTTP 402 used as programmable payment-required surface |
| **Catalog** | Normalized SKU-like menu machine readable |
| **Fulfill** | Merchant operational completion acknowledgement distinct from financially **PAID** |

---

**Upstream context:** [Root `README.md`](https://github.com/nikhlu07/MAXIS#readme) in **`nikhlu07/MAXIS`**
