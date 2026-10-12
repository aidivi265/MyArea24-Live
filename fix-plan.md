# MyArea24 — Fix Plan

## Overview

This plan addresses every confirmed bug and missing feature found by directly reading the source code. Sub-tasks are ordered by severity and dependency: blockers first, then missing features, then demo readiness. Each sub-task is designed to be implemented and reviewed independently.

---

## Sub-Task 1 — Fix: `NameError` crash in `/intelligence/assistant` endpoint

**Status:** `[x] done`

### Intent
The `/assistant` endpoint crashes with a Python `NameError` on every invocation because the variable `is_live_supported` is referenced but never assigned. The `_resolve_locality_context()` helper returns four values; the last one (the boolean) is discarded with `_` at line 634, then used by name at line 643.

### Root Cause
**File:** `backend/app/api/intelligence.py`, line 634 and 643

```python
# Line 634 — fourth return value thrown away
target_lat, target_lon, area_name, _ = _resolve_locality_context(area, None, None)

# Line 643 — refers to name that was never bound → NameError at runtime
is_live_supported=is_live_supported,
```

### Expected Outcomes
- `GET /api/v1/intelligence/assistant?query=...` no longer raises a 500 Internal Server Error.
- The Gemini branch and the deterministic fallback branch both execute without crash.
- All existing backend tests continue to pass.

### Todo List
1. In `backend/app/api/intelligence.py` line 634, change `_` to `is_live_supported` so it captures the fourth return value.
2. Verify no other call to `_resolve_locality_context` in the same file has the same issue.
3. Run `pytest tests/` to confirm no regressions.

### Relevant Context
- `_resolve_locality_context()` is defined at line 432 and always returns `(lat, lon, area_name, True)`.
- `query_gemini_assistant()` is imported from `backend/app/services/gemini_assistant.py` and accepts `is_live_supported` as a kwarg.

---

## Sub-Task 2 — Fix: Vite dev proxy points to wrong backend port

**Status:** `[x] done`

### Intent
The Vite dev server proxies all `/api` requests to `http://localhost:8001`, but the backend starts on port `8000` (per `uvicorn ... --port 8000` in `backend/app/main.py`). This means every API call in local development silently fails with a connection-refused error, making the entire frontend non-functional when run locally.

### Root Cause
**File:** `frontend/vite.config.ts`, line 50

```ts
proxy: {
  '/api': { target: 'http://localhost:8001', changeOrigin: true },
  //                              ^^^^ should be 8000
}
```

### Expected Outcomes
- Running `npm run dev` with the backend on port 8000 successfully proxies API calls.
- Home page loads weather/traffic/insights data without network errors.

### Todo List
1. In `frontend/vite.config.ts` line 50, change the proxy target from `http://localhost:8001` to `http://localhost:8000`.

### Relevant Context
- Backend default: `uvicorn ... --port 8000` in `backend/app/main.py` line 126.
- The mismatch is port `8001` vs `8000` — a one-digit difference introduced at some point.

---

## Sub-Task 3 — Fix: CORS does not allow the Vite dev server port (5174)

**Status:** `[x] done`

### Intent
The Vite dev server is configured to run on port `5174` (`server.port: 5174` in `vite.config.ts`), but `backend/app/core/config.py` lists `ALLOWED_ORIGINS` that include ports 5173, 3000, 8080, and 4173 — but **not** 5174. Browsers enforce CORS for credentialed requests (those sending the `Authorization: Bearer ...` JWT header). Any authenticated API call (profile, saved items, merchant dashboard, admin) will be blocked by the browser with a CORS preflight rejection in development.

### Root Cause
**File:** `backend/app/core/config.py`, lines 43–54

The default `ALLOWED_ORIGINS` list is missing `"http://localhost:5174"` and `"http://127.0.0.1:5174"`.

Additionally, `ALLOWED_ORIGIN_REGEX` at line 55 uses `(:\d+)?` which already matches any port on localhost — so the regex is fine. The explicit list just needs the two entries added so credentialed requests pass without relying solely on the regex path.

### Expected Outcomes
- Authenticated frontend calls from `localhost:5174` pass CORS preflight.
- No CORS errors appear in browser console for any logged-in user flow.

### Todo List
1. In `backend/app/core/config.py`, add `"http://localhost:5174"` and `"http://127.0.0.1:5174"` to the `ALLOWED_ORIGINS` default list.
2. Also add both entries to `.env.example` in the `ALLOWED_ORIGINS` line for documentation accuracy.

### Relevant Context
- Vite port configured at `frontend/vite.config.ts` line 48: `port: 5174`.
- The regex `^https?://(localhost|127\.0\.0\.1)(:\d+)?$` already covers it, but the explicit list is what matters for `allow_credentials=True` mode.

---

## Sub-Task 4 — Fix: `sortBy` selector on Businesses page does nothing

**Status:** `[x] done`

### Intent
`BusinessesPage` renders a "Nearest First / Highest Rated" sort dropdown, but the selected value is never passed to the `businessApi.list()` call. The state variable `sortBy` is declared and updated on change but is absent from the query params object, so the sort selector has zero effect.

### Root Cause
**File:** `frontend/src/pages/marketplace/BusinessesPage.tsx`, lines 16 and 22–28

```ts
const [sortBy, setSortBy] = useState('distance')   // line 16 — declared

queryFn: () => businessApi.list({
  q: search || undefined,
  category: category || undefined,
  locality: selectedArea,
  user_lat: selectedLat ?? undefined,
  user_lon: selectedLon ?? undefined,
  open_now: openNow || undefined,
  page, page_size: 12,
  // ← sortBy is missing here
}),
```

### Expected Outcomes
- Selecting "Highest Rated" actually sends `sort_by=rating` to the backend.
- Selecting "Nearest First" sends `sort_by=distance`.
- The query key includes `sortBy` so React Query re-fetches when sort changes.

### Todo List
1. Add `sortBy` to the `queryKey` array (currently line 21) alongside `search`, `category`, `openNow`, `page`.
2. Add `sort_by: sortBy` to the params object inside `businessApi.list(...)`.
3. Verify the backend `GET /businesses` endpoint accepts a `sort_by` query parameter (check `backend/app/api/businesses.py`). If the parameter name differs, match it exactly.

### Relevant Context
- Backend file: `backend/app/api/businesses.py` — confirm accepted param name.
- The `user_lat` and `user_lon` params are already sent, so distance sort should work once wired.

---

## Sub-Task 5 — Fix: `/bulletins` route renders `MarketPage` instead of bulletins content

**Status:** `[x] done`

### Intent
The sidebar links to `/bulletins` (a civic notices sub-feature), but `App.tsx` routes both `/market` and `/bulletins` to the same `MarketPage` component, which only shows mandi rates and fuel prices. Civic bulletins are a separate dataset (the `civic_bulletins` table and `GET /api/v1/bulletins` endpoint). The `/bulletins` route needs its own dedicated page, or `MarketPage` must be extended to show bulletins when the path is `/bulletins`.

### Root Cause
**File:** `frontend/src/App.tsx`, line 74

```tsx
<Route path="/bulletins" element={<Suspense ...><MarketPage /></Suspense>} />
// ↑ MarketPage never renders bulletins content — it only shows mandi/fuel
```

**File:** `frontend/src/components/layout/Sidebar.tsx`, line 41 — the sidebar correctly links to `/bulletins` with a Newspaper icon, expecting bulletins content.

### Expected Outcomes
- Navigating to `/bulletins` shows a list of civic bulletins (title, summary, source agency, priority badge, date).
- The existing `/market` route is unchanged.
- The sidebar "Bulletins" link highlights correctly on `/bulletins`.

### Todo List
1. Create `frontend/src/pages/civic/BulletinsPage.tsx` that:
   - Calls `marketApi.bulletins()` via `useQuery`.
   - Renders each `CivicBulletin` with title, summary, source_agency, priority badge (high=red, medium=amber, low=gray), and published_at date.
   - Shows `EmptyState` when no bulletins exist.
   - Shows `CardSkeleton` while loading.
   - Includes `SEOMeta` with title "Civic Bulletins".
2. In `frontend/src/App.tsx`, add a lazy import for `BulletinsPage` and replace the `/bulletins` route to use it (remove the `MarketPage` alias on that path).

### Relevant Context
- `marketApi.bulletins()` is already defined in `frontend/src/services/apiService.ts` line 76.
- `CivicBulletin` type is defined in `frontend/src/types/index.ts` lines 298–309.
- `backend/app/api/market.py` already serves `GET /api/v1/bulletins`.

---

## Sub-Task 6 — Fix: Merchant page is a dead end — no way to register a business

**Status:** `[x] done`

### Intent
When a merchant logs in without a business linked to their account, `MerchantPage` shows an empty state with the message "Register a business to access the merchant dashboard" but provides no button or form to do so. `businessApi.create()` and `POST /api/v1/businesses` already exist. A simple inline registration form needs to be added.

### Root Cause
**File:** `frontend/src/pages/merchant/MerchantPage.tsx`, lines 36–42

```tsx
if (!businessId) return (
  <div className="text-center py-16">
    <Store className="h-12 w-12 text-gray-200 mx-auto mb-4" />
    <p className="font-semibold text-gray-600">No business linked to your account.</p>
    <p className="text-sm text-gray-400 mt-1">Register a business to access the merchant dashboard.</p>
    {/* ← No CTA, no form, nothing actionable */}
  </div>
)
```

### Expected Outcomes
- A merchant without a business sees a "Register Your Business" form with: Name, Category, Address, City, Phone, WhatsApp (optional), Opening/Closing times.
- Submitting the form calls `businessApi.create()` and on success refreshes the auth user (so `user.businesses` is populated).
- After registration the dashboard loads showing the new business stats.
- The form shows a loading spinner during submission and a clear error message on failure.

### Todo List
1. In `MerchantPage.tsx`, replace the static empty state block (lines 36–42) with a `RegisterBusinessForm` inline component (can live in the same file).
2. The form needs controlled inputs for: `name` (required), `category` (required), `address`, `city`, `phone`, `whatsapp`, `opening_time`, `closing_time`.
3. On submit, call `businessApi.create(formData)` using a `useMutation` hook.
4. On mutation success, call `authApi.me()` to re-fetch the user and call `setUser()` from `useAuthStore` so `user.businesses` is populated and the page re-renders with the dashboard.
5. Categories can be fetched from `businessApi.categories()` to populate a `<select>`, or provide a free-text input if no categories exist yet.

### Relevant Context
- `businessApi.create()` is in `frontend/src/services/apiService.ts` line 25.
- `BusinessCreateRequest` type is in `frontend/src/types/index.ts` lines 66–72.
- `authApi.me()` is in `apiService.ts` line 16; `setUser` is in `store/index.ts` line 47.
- `void X` at line 112 of `MerchantPage.tsx` is a dead import suppressor — can be removed after this fix.

---

## Sub-Task 7 — Fix: No product detail page — `/products/:id` route missing

**Status:** `[x] done`

### Intent
`ProductCard` wraps every product in a `<Link to={/products/${product.id}>` but no route for `/products/:id` exists in `App.tsx`. Clicking a product card triggers a React Router "no match" → redirect to `/`. Users cannot view product details, compare prices, or see similar products.

### Root Cause
**File:** `frontend/src/App.tsx` — no `<Route path="/products/:id" ...>` defined.
**File:** `frontend/src/components/marketplace/ProductCard.tsx` line 21 — links to `/products/${product.id}`.

### Expected Outcomes
- Clicking a product card navigates to `/products/:id` and shows: product name, brand, image, local price, MRP, online price (with comparison badge), stock status, description, and the selling business name/link.
- The page uses `productApi.get(id)` to fetch `ProductDetail` which includes `similar_products`.
- An optional "Similar Products" horizontal scroll section renders below if `similar_products` is non-empty.
- Shows `PageSkeleton` while loading; `ErrorState` on failure.

### Todo List
1. Create `frontend/src/pages/marketplace/ProductDetailPage.tsx`:
   - Read `id` from `useParams()`.
   - Call `productApi.get(Number(id))` via `useQuery`.
   - Render: image, name, brand, category, price block (local vs MRP vs online comparison), stock badge, description, business link (`/businesses/${product.business?.slug}`).
   - If `data.similar_products` has items, render a horizontal scrollable row of `ProductCard` components below.
   - Include `SEOMeta` with the product name as title.
2. In `frontend/src/App.tsx`, add a lazy import for `ProductDetailPage` and add the route `<Route path="/products/:id" element={...} />` after the `/products` route (around line 67).

### Relevant Context
- `productApi.get(id)` is defined in `apiService.ts` line 32.
- `ProductDetail` type (extends `Product` with `similar_products?: Product[]`) is in `types/index.ts` line 101.
- `BusinessCard` and `ProductCard` components are available for reuse.

---

## Sub-Task 8 — Fix: No insight detail page — `/intelligence/:id` route missing

**Status:** `[x] done`

### Intent
`InsightCard` renders a "View Details" link to `/intelligence/${insight.id}` but no such route exists. The link currently navigates to the catch-all `*` redirect → home. Users cannot see full insight details, signal provenance, or recommendations.

### Root Cause
**File:** `frontend/src/App.tsx` — no `<Route path="/intelligence/:id" ...>` defined.
**File:** `frontend/src/components/intelligence/InsightCard.tsx` line 44 — links to `/intelligence/${insight.id}`.

### Expected Outcomes
- Clicking "View Details" on an insight card navigates to `/intelligence/:id`.
- The page shows: headline, severity badge, area label, summary, recommendation, evidence quality, confidence level, observed_at timestamp, and the list of signals (type, source, metric_summary, freshness_minutes).
- A "← Back to Feed" link returns to `/intelligence`.
- Shows `PageSkeleton` while loading; `ErrorState` on failure; a 404 message for non-existent IDs.

### Todo List
1. Create `frontend/src/pages/intelligence/InsightDetailPage.tsx`:
   - Read `id` from `useParams()`.
   - Call `intelligenceApi.get(Number(id))` via `useQuery`.
   - Render: severity banner, headline, area/location chip, summary, recommendation box, evidence quality, confidence badge.
   - Render signals section: for each signal in `data.signals`, show type, source, metric_summary, and a freshness chip.
   - Use `SEVERITY_STYLES` from utils for color styling.
   - Include `SEOMeta` with the insight headline as title.
2. In `frontend/src/App.tsx`, add a lazy import for `InsightDetailPage` and add `<Route path="/intelligence/:id" element={...} />` **after** all the named `/intelligence/*` sub-routes (important: more specific routes must come before the param route). Place it after line 85 but before the auth-protected routes.

### Relevant Context
- `intelligenceApi.get(id)` is defined in `apiService.ts` line 64.
- `IntelligenceInsight` and `IntelligenceSignal` types are in `types/index.ts` lines 177–193.
- `SEVERITY_STYLES` and `formatRelativeTime` are available in `utils/index.ts`.
- Route ordering matters: React Router v7 uses the order in the JSX tree. The specific `/intelligence/weather`, `/intelligence/assistant` etc. routes already come before the catch-all, so add `/:id` after those.

---

## Sub-Task 9 — Fix: PWA icons folder is empty

**Status:** `[x] done`

### Intent
`vite.config.ts` declares PWA icons at `/icons/icon-192.png` and `/icons/icon-512.png`, and `frontend/index.html` references `<link rel="icon" href="/favicon.svg">`. The `frontend/public/icons/` folder exists but is empty (confirmed by directory listing). The PWA install prompt will fail, the browser tab shows no favicon (SVG fallback only), and Lighthouse PWA audit will fail with "icons are not the right size".

### Root Cause
`frontend/public/icons/` — directory exists but contains zero files.

### Expected Outcomes
- `frontend/public/icons/icon-192.png` exists (192×192 PNG, the MyArea24 brand mark).
- `frontend/public/icons/icon-512.png` exists (512×512 PNG, same mark, maskable).
- PWA install prompt works on Android Chrome.
- Lighthouse PWA category passes icon checks.

### Todo List
1. Create or export a 512×512 PNG of the MyArea24 logo (green "M" on brand-500 background).
2. Generate a 192×192 downscaled version from it.
3. Place both files in `frontend/public/icons/` with the exact names `icon-192.png` and `icon-512.png`.
4. Verify `frontend/public/favicon.svg` exists (it does — confirmed) and is a valid SVG.

### Relevant Context
- `frontend/public/favicon.svg` already exists and can be used as the source vector.
- `frontend/public/icons.svg` also exists (note: no directory slash) — this might be the source art.
- Vite PWA references exact filenames in `vite.config.ts` lines 23–26.

---

## Sub-Task 10 — Demo Readiness: Run seed script to populate database

**Status:** `[x] done`

### Intent
On a fresh checkout, the SQLite database is empty. Every page shows "No data available" / empty states. The seed script `scripts/seed_marketplace_data.py` exists and must be run to populate demo businesses, products, offers, events, mandi rates, and emergency facilities before any demo or review.

### Expected Outcomes
- After running the seed script, key pages show real-looking demo data.
- Businesses page shows a grid of business cards.
- Products page shows product listings with price comparison badges.
- Offers page shows discount cards.
- Market page shows mandi rates table.
- Emergency page shows hospital cards.

### Todo List
1. Review `scripts/seed_marketplace_data.py` to understand what it seeds and what pre-conditions it needs (running backend? direct DB write?).
2. Document the exact command to run the seed in a `QUICKSTART.md` or update the existing README.
3. Ensure the seed script is idempotent (won't duplicate data on re-run) — check and add upsert logic if missing.
4. Add a note in `.env.example` that seeding is required for a non-empty demo.

### Relevant Context
- `scripts/seed_marketplace_data.py` exists (untracked in git as `??`).
- The database file `myarea24.db` (WAL mode, `.db-shm` and `.db-wal` sidecar files present) suggests it has been used before.

---

## Sub-Task 11 — Config: Set `INGESTION_ENABLED=true` and verify at least one external API key

**Status:** `[x] done`

### Intent
All intelligence features (weather, traffic, AQI, alerts, AI assistant) return "UNAVAILABLE" or "AWAITING_CONFIG" states because `INGESTION_ENABLED=false` (the default) means no background polling runs and the database has no telemetry. For any meaningful demo the ingestion must be enabled and at least one API key configured.

### Expected Outcomes
- Setting `INGESTION_ENABLED=true` with a valid `WEATHERAPI_API_KEY` causes weather observations to appear in the DB within 30 minutes.
- The home page weather widget shows real temperature/conditions instead of an unavailable state.
- The AI assistant's deterministic fallback engine has data to reason from.

### Todo List
1. In `.env` (local, not committed), set `INGESTION_ENABLED=true`.
2. Obtain at least a free-tier `WEATHERAPI_API_KEY` from weatherapi.com (free plan: 1M calls/month) and set it in `.env`.
3. Optionally set `TOMTOM_API_KEY` for traffic data (TomTom free tier: 2500 req/day).
4. Restart the backend server so the scheduler starts.
5. Verify that after ~2 minutes (`WEATHER_POLL_INTERVAL_MINUTES=30` can be temporarily lowered to 1 for testing) a `WeatherObservation` row appears in the DB.
6. Document this in a `QUICKSTART.md` section "Enabling Live Data".

### Relevant Context
- Ingestion scheduler: `backend/app/ingestion/scheduler.py`.
- Settings: `backend/app/core/config.py` lines 94, 142.
- Default weather poll interval: 30 minutes (can be changed via `WEATHER_POLL_INTERVAL_MINUTES` env var).

---

## Fix Priority Summary

| # | Sub-Task | Type | Severity | Effort |
|---|----------|------|----------|--------|
| 1 | `NameError` in `/assistant` endpoint | Bug | 🔴 Blocker | Tiny (1 line) |
| 2 | Vite proxy port 8001 → 8000 | Bug | 🔴 Blocker | Tiny (1 char) |
| 3 | CORS missing port 5174 | Bug | 🔴 Blocker | Tiny (2 lines) |
| 4 | `sortBy` not sent to API | Bug | 🟡 Medium | Small (2 lines) |
| 5 | `/bulletins` wrong page | Bug | 🟡 Medium | Small (new page) |
| 6 | No merchant business registration | Missing | 🟠 High | Medium (form) |
| 7 | No product detail page | Missing | 🟡 Medium | Small (new page) |
| 8 | No insight detail page | Missing | 🟡 Medium | Small (new page) |
| 9 | PWA icons empty | Missing | 🟡 Medium | Small (assets) |
| 10 | No seed data | Config | 🟠 High | Small (script run) |
| 11 | Ingestion disabled | Config | 🟠 High | Config only |

---

## Implementation Notes

- Sub-tasks 1, 2, 3 can be applied in a single commit — they are one-line fixes with no UI.
- Sub-tasks 4, 5, 6, 7, 8 are all frontend-only changes; they can be batched into one frontend PR.
- Sub-tasks 9, 10, 11 are asset/config tasks and can be done in parallel with code tasks.
- After completing sub-tasks 1–3, do a full smoke test: start backend, start frontend, verify the home page loads data.
- After completing sub-tasks 6–8, do a user journey test: sign up → register business → view merchant dashboard; click product → view detail; click insight → view detail.
