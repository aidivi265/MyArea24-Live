# MyArea24 — Frontend Implementation Plan

## Top-Level Overview

Build a **production-grade, PWA-ready frontend** for the MyArea24 Local Intelligence Engine.
The app targets Indian residents, local merchants, and administrators with a geolocation-first experience.

**Stack:**
- React 18 + Vite + TypeScript
- Tailwind CSS v3 + shadcn/ui (pre-built accessible components)
- Framer Motion (page and micro-animations)
- React Router v6 (client-side routing with lazy loading)
- React Query / TanStack Query v5 (server state, caching, refetch)
- Leaflet.js + React-Leaflet (interactive maps, OpenStreetMap tiles)
- i18next + react-i18next (English ↔ Hindi bilingual toggle)
- Vite PWA Plugin (service worker + web manifest for installability)
- React Helmet Async (per-page SEO meta tags / Open Graph)

**Brand:** Forest Green (`#1A5C38`) primary, Gold (`#C9A84C`) accent, warm off-white (`#FAF7F0`) background.

**Principles:**
- Mobile-first responsive layouts (320 px → 1440 px+)
- Zero synthetic data — all widgets show graceful UNAVAILABLE states when backend returns no data
- Minimal bundle — route-level code splitting via `React.lazy`
- Accessibility (WCAG 2.1 AA), keyboard navigation, ARIA labels

---

## Architecture Overview

```
frontend/
├── public/               # Static assets, manifest.json, icons
├── src/
│   ├── assets/           # Fonts, hero images, SVG icons
│   ├── components/       # Shared UI components (shadcn wrappers, custom)
│   │   ├── layout/       # TopNav, BottomNav, Sidebar, Footer
│   │   ├── ui/           # Re-exported shadcn/ui primitives
│   │   ├── map/          # Leaflet map components
│   │   ├── intelligence/ # InsightCard, WeatherWidget, AQIBadge, etc.
│   │   ├── marketplace/  # BusinessCard, ProductCard, ServiceCard, etc.
│   │   └── shared/       # LoadingSkeleton, ErrorState, EmptyState, OTPModal
│   ├── pages/            # Route-level page components (lazy-loaded)
│   ├── services/         # Typed API client (axios + React Query hooks)
│   ├── store/            # Zustand global state (auth, location, theme, language)
│   ├── hooks/            # useGeolocation, useIntersectionObserver, etc.
│   ├── i18n/             # Translation files (en.json, hi.json)
│   ├── types/            # TypeScript interfaces matching API schemas
│   ├── utils/            # Formatters, AQI color maps, distance helpers
│   └── main.tsx
├── index.html            # SEO base meta, PWA manifest link
├── vite.config.ts        # Vite + PWA plugin config
├── tailwind.config.ts    # Custom color tokens, fonts
└── tsconfig.app.json
```

---

## Sub-Tasks

---

### Sub-Task 1 — Project Scaffold & Design System

**Status:** `[ ] pending`

**Intent:**
Bootstrap the Vite project, configure Tailwind with the Forest Green / Gold brand tokens, install and configure shadcn/ui, set up Framer Motion, configure the PWA plugin, and establish folder conventions so all subsequent sub-tasks build on a solid base.

**Expected Outcomes:**
- `npm run dev` starts the dev server with a blank branded shell page
- Tailwind custom colors, fonts (Inter for UI, Noto Sans Devanagari for Hindi), and dark-mode class strategy in place
- shadcn/ui CLI initialized; base components (Button, Card, Badge, Dialog, Sheet, Input, Select, Skeleton, Tabs, Toast) installed
- `vite-plugin-pwa` configured with manifest.json (name, icons, theme_color `#1A5C38`, display standalone)
- Service worker registered (Workbox GenerateSW strategy with stale-while-revalidate for API calls)
- `react-helmet-async` HelmetProvider wrapping the app root for per-page SEO

**Todo List:**
1. Run `npm create vite@latest frontend -- --template react-ts`
2. Install dependencies: `tailwindcss postcss autoprefixer`, `framer-motion`, `@tanstack/react-query`, `axios`, `react-router-dom`, `zustand`, `react-helmet-async`, `i18next react-i18next`, `leaflet react-leaflet @types/leaflet`, `vite-plugin-pwa`, `lucide-react`
3. Initialize Tailwind; add custom color tokens (`brand`, `gold`, `surface`) and font families to `tailwind.config.ts`
4. Initialize shadcn/ui (`npx shadcn-ui@latest init`); install base component set
5. Configure `vite.config.ts` with `VitePWA` plugin, `@vitejs/plugin-react`, proxy to `http://localhost:8000`
6. Write `public/manifest.json` with app name, icons, theme color, start URL
7. Create `src/store/index.ts` with Zustand slices: `authSlice`, `locationSlice`, `uiSlice`
8. Create `src/types/` folder with TypeScript interfaces matching all API response shapes
9. Wrap `main.tsx` with `QueryClientProvider`, `HelmetProvider`, `RouterProvider`, `I18nextProvider`

**Relevant Context:**
- Backend CORS allows `localhost:5173` — Vite default port
- API base: `http://localhost:8000/api/v1`
- All list endpoints return `{items[], total, page, page_size}` — create a generic `PaginatedResponse<T>` type

---

### Sub-Task 2 — App Shell: Navigation, Layout, & i18n

**Status:** `[ ] pending`

**Intent:**
Build the persistent app chrome — a top navigation bar (desktop), a bottom navigation bar (mobile), a collapsible sidebar, and a language toggle. This gives every page a consistent frame and establishes responsive breakpoints.

**Expected Outcomes:**
- Desktop: Fixed top navbar with logo, locality selector, search bar, language toggle (EN/HI), user avatar / login CTA
- Mobile: Sticky bottom navigation with 5 icons (Home, Explore, Map, Alerts, Me) + a hamburger sheet for full menu
- Locale-aware: All navbar labels switch between English and Hindi via `react-i18next`
- Smooth slide-in sidebar on mobile (Framer Motion `AnimatePresence`)
- Active route highlighted with gold underline / indicator

**Todo List:**
1. Create `src/i18n/en.json` and `src/i18n/hi.json` with all UI labels (nav, buttons, form labels, error messages)
2. Configure `i18next` with language detection (localStorage `lang` key, default `en`)
3. Build `<TopNav>` — logo (SVG), locality badge, global search input, `<LanguageToggle>`, `<UserMenu>`
4. Build `<BottomNav>` — mobile only (hidden on `md:` breakpoint), icon + label tabs
5. Build `<Sidebar>` — full feature list grouped by category; Sheet component on mobile, static on desktop
6. Build `<LocalitySelector>` — calls `GET /api/v1/location/search` to let user pick their area; persisted in Zustand `locationSlice`
7. Add `<LanguageToggle>` button cycling EN ↔ HI; updates `i18next` language and `<html lang>` attribute
8. Create `src/components/layout/AppShell.tsx` that composes TopNav + outlet + BottomNav
9. Set up `<SEOMeta>` component using `react-helmet-async` with default Open Graph tags

**Relevant Context:**
- Pilot locations: Delhi AIIMS Ring Road, Connaught Place, Rohini Sector 11, Bengaluru Silk Board, Indiranagar
- `GET /api/v1/location/search?q=` — minimum 2 characters, returns locality / district results
- `GET /api/v1/intelligence/localities` — returns the full pilot location list for dropdown

---

### Sub-Task 3 — Authentication Flow (OTP Login / Signup)

**Status:** `[ ] pending`

**Intent:**
Implement a seamless, password-less OTP authentication flow. Users enter their email, receive a 6-digit OTP, and are issued a JWT stored in localStorage. The flow handles new user signup (role selection) and existing user login in one unified modal.

**Expected Outcomes:**
- `<AuthModal>` — a full-screen overlay (Dialog) with two steps: Email Input → OTP Verification
- Step 1: Email input + purpose selection (login / signup); calls `POST /api/v1/auth/send-otp`
- Step 2: 6-digit OTP input (individual digit boxes), 10-minute countdown timer; calls `POST /api/v1/auth/verify-otp`
- New user step: Inline name input + role selector (Resident / Merchant) on first OTP verify
- Stores JWT in `localStorage`; hydrates Zustand `authSlice` on app load
- Protected routes redirect unauthenticated users to the auth modal
- Dev mode shows OTP inline in the response so developers can test without SMTP

**Todo List:**
1. Create `src/services/auth.ts` with typed axios calls for `send-otp` and `verify-otp`
2. Build `<AuthModal>` with two animated steps (Framer Motion slide transition)
3. Step 1: `<EmailStep>` — email validation, `purpose` radio (login / signup), submit
4. Step 2: `<OTPStep>` — 6 auto-focus digit boxes, resend button (after 60s cooldown), countdown timer
5. New user branch: show `full_name` input + role selector inside `<OTPStep>` when `purpose === 'signup'`
6. On success: store token in localStorage, update `authSlice`, close modal, show success toast
7. Create `src/store/authSlice.ts` — `user`, `token`, `isAuthenticated`, `login()`, `logout()`
8. Create `useAuth` hook — exposes auth state and triggers modal open
9. Add JWT auto-attach to axios instance via request interceptor
10. Add 401 response interceptor — clears auth state and opens login modal

**Relevant Context:**
- `POST /api/v1/auth/send-otp` → `{success, message, email, expires_in_minutes, dev_otp?}`
- `POST /api/v1/auth/verify-otp` → `{access_token, token_type, user{id, email, role, businesses[]}}`
- `GET /api/v1/auth/me` — called on app boot to rehydrate auth from stored token
- JWT payload: `{sub, email, role, exp}`; role values: `resident`, `merchant`, `admin`

---

### Sub-Task 4 — Home Page (Dashboard / Landing)

**Status:** `[ ] pending`

**Intent:**
Create the primary landing page that acts as a live local dashboard. It surfaces the most important real-time intelligence widgets, quick-access tiles to all features, and a hero section that communicates the app's value proposition to new visitors.

**Expected Outcomes:**
- Hero section: animated tagline, locality selector CTA, "Install App" PWA prompt badge
- "Local Conditions" strip: Weather widget, AQI badge, Traffic status chip — live data from intelligence APIs
- "Latest Insights" row: Horizontal scroll of `<InsightCard>` components (top 4 active insights)
- "Explore Your Area" quick-links grid: 8 tiles (Businesses, Products, Services, Offers, Events, Map, Alerts, Emergency) with animated hover
- "Deals Near You" preview: Top 3 active offers as cards
- "Community Events" preview: Next 2 upcoming events
- SEO: `<title>MyArea24 – Local Intelligence for [Locality]</title>`, Open Graph image, structured data JSON-LD (LocalBusiness schema)

**Todo List:**
1. Create `src/pages/HomePage.tsx` as the `/` route
2. Build `<HeroBanner>` — gradient background (Forest Green → dark), animated text with Framer Motion, `<LocalitySelector>`, PWA install prompt button
3. Build `<LocalConditionsStrip>` — calls weather, AQI, traffic APIs in parallel with React Query; shows skeleton while loading
4. Build `<InsightCard>` — severity color badge, headline, summary snippet, "View Details" link; animated entrance with `motion.div`
5. Build `<QuickAccessGrid>` — 8 icon+label tiles; hover lifts with shadow (Framer Motion `whileHover`)
6. Build `<DealsPreview>` and `<EventsPreview>` — each a horizontal scroll row with "View All" CTA
7. Add `<SEOMeta>` with dynamic locality name, canonical URL, JSON-LD `WebSite` + `Organization` schema
8. Add Intersection Observer staggered entrance animations for each homepage section

**Relevant Context:**
- `GET /api/v1/intelligence/weather?area=` — WeatherStatusResponse
- `GET /api/v1/intelligence/air-quality?area=` — AirQualityStatusResponse
- `GET /api/v1/intelligence/traffic?area=` — TrafficStatusResponse
- `GET /api/v1/intelligence/?is_active=true&page_size=4` — top insights
- `GET /api/v1/offers/?page_size=3` — recent deals
- `GET /api/v1/events/?page_size=2` — upcoming events

---

### Sub-Task 5 — Local Intelligence Views (Weather, AQI, Traffic, Alerts, Insights, AI Assistant)

**Status:** `[ ] pending`

**Intent:**
Build dedicated pages for each intelligence signal plus the correlated insights feed. This is the core differentiator of MyArea24 — real-time, multi-source local intelligence with an AI assistant.

**Expected Outcomes:**
- `/intelligence` — paginated `<InsightCard>` feed with filter bar (severity, insight_type, area)
- `/intelligence/weather` — full weather detail page (icon, temperature, wind rose, humidity bar, precipitation gauge)
- `/intelligence/air-quality` — AQI gauge (color-coded 0-500 CPCB scale), pollutant breakdown table
- `/intelligence/traffic` — incident list with severity chips; each incident shown on a `<MiniMap>`
- `/intelligence/alerts` — NDMA SACHET government disaster bulletins (red banner for severe)
- `/intelligence/assistant` — Chat-style AI assistant UI; user types query, response shown as structured cards
- All pages: SEO meta, breadcrumb schema, skeleton loaders, error / unavailable states

**Todo List:**
1. Create route group `src/pages/intelligence/` with index + child pages
2. Build `<InsightFeed>` with filter bar (shadcn Select for severity/type, area) + infinite scroll (TanStack Query `useInfiniteQuery`)
3. Build `<WeatherPage>` — full card layout with Lucide weather icons, all WeatherStatusResponse fields
4. Build `<AQIGauge>` component — SVG arc gauge colored by AQI category (Good/Satisfactory/Moderate/Poor/Very Poor/Severe)
5. Build `<AirQualityPage>` — gauge + pollutant grid table (PM2.5, PM10, NO₂, SO₂, CO, O₃)
6. Build `<TrafficPage>` — incident list sorted by criticality; `<IncidentChip>` per incident type
7. Build `<AlertsPage>` — timeline-style list; severity-colored left border; active vs expired tab
8. Build `<AssistantPage>` — chat input bar at bottom, message bubbles (user query + AI structured response), grounded sources chips
9. Add `<UnavailableState>` — shown when `is_available: false` or `total_incidents: 0`
10. Per-page `<SEOMeta>` with signal-specific keywords (e.g., "Delhi AQI today", "traffic conditions near me")

**Relevant Context:**
- `GET /api/v1/intelligence/` — paginated insights; filter by `severity`, `insight_type`, `area`
- `GET /api/v1/intelligence/assistant?query=&area=` — returns `{response_text, key_findings[], recommendations[], grounded_sources[], confidence}`
- AQI categories: Good (0-50), Satisfactory (51-100), Moderate (101-200), Poor (201-300), Very Poor (301-400), Severe (401+)
- Traffic criticality: `critical`=red, `major`=orange, `minor`=yellow, `low`=green

---

### Sub-Task 6 — Marketplace: Businesses, Products, Services, Offers

**Status:** `[ ] pending`

**Intent:**
Build the local marketplace discovery experience — the largest feature surface. Users can browse and search businesses, compare product prices, find service providers, and view deals.

**Expected Outcomes:**
- `/businesses` — searchable, filterable business directory with distance sorting
- `/businesses/:slug` — full storefront: business info + products tab + offers tab + enquiry form
- `/products` — product search with category/brand/price filters + price comparison badges
- `/products/:id` — product detail: price comparison card (local vs online savings), similar products, enquiry CTA
- `/services` — service provider cards with category filter, rating, experience
- `/services/:id` — service detail page
- `/offers` — deals grid with countdown chips (`X days left`)
- All listings: skeleton loaders, empty states, error states, SEO meta

**Todo List:**
1. Create `src/services/marketplace.ts` with all typed API hooks (useBusinesses, useBusiness, useProducts, useProduct, useServices, useService, useOffers)
2. Build `<BusinessCard>` — name, category badge, rating stars, distance chip, open/closed indicator, call/WhatsApp/direction action buttons
3. Build `<BusinessDirectory>` page — `<FilterBar>` (category Select, open_now toggle, sort dropdown), `<BusinessCard>` grid, pagination
4. Build `<BusinessStorefront>` page — cover image, contact actions row, Tabs (Products / Offers / About), map pin
5. Build `<ProductCard>` — image, name, brand, local price, online price comparison badge (green "Save ₹X locally"), stock status chip
6. Build `<ProductsPage>` — filter bar (category, brand, price range slider, in_stock_only), sort by (price_asc, price_desc, distance, relevance)
7. Build `<ProductDetailPage>` — price comparison card, "Better Offline" badge, freshness label, similar products horizontal scroll, `<EnquiryForm>`
8. Build `<ServiceCard>` — provider name, category, locality, rating, price_starting_at, experience_years badge
9. Build `<ServicesPage>` and `<ServiceDetailPage>`
10. Build `<OfferCard>` — banner image, title, discount_text in gold badge, countdown chip, coupon code copy button
11. Build `<OffersPage>` with category + locality filters
12. Add `<EnquiryModal>` — customer name/phone/email/message form; calls `POST /api/v1/enquiries/`
13. Add analytics tracking: call `POST /api/v1/enquiries/track-click` on phone/WhatsApp/direction button clicks
14. Per-page SEO: business name + locality in title; Product structured data JSON-LD (`Product` schema with price, availability)

**Relevant Context:**
- `GET /api/v1/businesses?q=&category=&locality=&user_lat=&user_lon=&open_now=&page=&page_size=`
- `GET /api/v1/businesses/{id_or_slug}` → `{business, products[], offers[]}`
- `GET /api/v1/products?sort_by=price_asc` — `savings_amount`, `savings_percent`, `better_offline`, `freshness_label` fields
- `POST /api/v1/enquiries/` — `{business_id, product_id?, service_id?, customer_name, customer_phone, customer_email, enquiry_type, message}`
- `POST /api/v1/enquiries/track-click` — `{business_id, event_type: 'call_click'|'direction_click'|'whatsapp_click'}`

---

### Sub-Task 7 — Events, Emergency Hub, Market Rates & Bulletins

**Status:** `[ ] pending`

**Intent:**
Build the civic information pages that make MyArea24 a genuine community utility — local events, emergency facility finder, mandi commodity prices, civic bulletins, and live fuel rates.

**Expected Outcomes:**
- `/events` — upcoming civic events with category filter and calendar-style date display
- `/emergency` — full-screen emergency hub: prominent emergency numbers (112/108/101), searchable hospital/trauma-center cards with distance
- `/market` — commodity prices table (APMC mandi rates) with state/search filter; trend arrows; fuel price card
- `/bulletins` — civic notices from municipal agencies, priority-sorted
- Emergency page: bold red/orange design language to communicate urgency

**Todo List:**
1. Create `src/pages/events/EventsPage.tsx` — category filter tabs (Civic Advisory, Community, Workshop, Market); `<EventCard>` with date/time/venue
2. Create `src/pages/emergency/EmergencyPage.tsx` — top section with 4 large call-to-action emergency number buttons (tel: links); `<FacilityCard>` list below
3. Build `<FacilityCard>` — name, facility_type badge, trauma_level, blood_bank_available chip, phone, distance_km, 24/7 badge
4. Create `src/pages/market/MarketPage.tsx` — data table of mandi prices (commodity, variety, mandi, modal_price, trend); state Select filter; search input
5. Build `<FuelRatesCard>` — petrol/diesel/CNG prices for selected city, last updated timestamp
6. Create `src/pages/bulletins/BulletinsPage.tsx` — priority-sorted notice cards; priority badge (high=red, medium=amber, low=green)
7. Add geolocation CTA on emergency page — "Find Nearest Hospital" uses browser GPS to call `GET /api/v1/emergency/facilities?latitude=&longitude=`
8. Per-page SEO: "Hospitals near [city]", "Petrol price today [city]", "Mandi rates [commodity] [state]" in page titles

**Relevant Context:**
- `GET /api/v1/events/?category=&locality=`
- `GET /api/v1/emergency/facilities?latitude=&longitude=&limit=` — returns `{national_emergency_number, ambulance_number, fire_number, disaster_number, facilities[]}`
- `GET /api/v1/market-rates?search=&state=` — returns `{total, items[], attribution}`
- `GET /api/v1/fuel-rates?city=`
- `GET /api/v1/bulletins?locality=&category=`

---

### Sub-Task 8 — Interactive Map View

**Status:** `[ ] pending`

**Intent:**
Build a full-screen Leaflet.js map that layers businesses, traffic incidents, emergency facilities, and real-time AQI stations on OpenStreetMap tiles. This is the "explore visually" mode of the app.

**Expected Outcomes:**
- `/map` — full-viewport Leaflet map centered on user's selected locality
- Layer toggles: Businesses, Traffic Incidents, Emergency Facilities, AQI Stations (each toggleable)
- Custom SVG marker icons per layer (green for business, red for incident, orange cross for hospital, purple for AQI)
- Click on marker → popup card with key info + "View Details" link
- Locate Me button — centers map on user's GPS coordinates, calls reverse geocode API
- Mobile: map fills screen, layer toggles as bottom sheet

**Todo List:**
1. Install `react-leaflet` and `leaflet`; create `src/components/map/MapContainer.tsx` wrapper
2. Design custom SVG marker icons for each layer type
3. Build `<BusinessLayer>` — fetches businesses for current map bounds, renders `<Marker>` + `<Popup>` with `<BusinessCard>` mini
4. Build `<TrafficLayer>` — fetches traffic incidents, renders incident markers with criticality-colored icons
5. Build `<EmergencyLayer>` — renders hospital/trauma markers
6. Build `<AQILayer>` — renders station markers colored by AQI category
7. Build `<LayerTogglePanel>` — floating control panel (top-right on desktop, bottom-sheet on mobile)
8. Build `<LocateMeButton>` — uses browser Geolocation API; on success, centers map and calls `GET /api/v1/location/reverse-geocode`
9. Create `src/pages/map/MapPage.tsx` — full-viewport layout (no top padding, no bottom padding), mounts `<MapContainer>` with all layers

**Relevant Context:**
- Leaflet requires CSS import: `import 'leaflet/dist/leaflet.css'`
- Default Leaflet marker icon path issue in Vite — must explicitly set `L.Icon.Default.mergeOptions({iconUrl, shadowUrl})`
- All business/incident/facility records include `latitude` and `longitude` fields
- `GET /api/v1/location/reverse-geocode?lat=&lon=` — returns `{village, town, tehsil, district, state}`

---

### Sub-Task 9 — User Profile, Saved Items & Merchant Dashboard

**Status:** `[ ] pending`

**Intent:**
Build the authenticated user zone — profile management, saved bookmarks, and the merchant analytics dashboard. Merchants see enquiry leads, analytics (views, clicks), and manage their listings.

**Expected Outcomes:**
- `/profile` — edit name, phone, role; logout button; account info card
- `/saved` — tabbed view of saved businesses / products / services / offers; unsave toggle
- `/merchant` — merchant dashboard: listing stats (views, call clicks), enquiry table with status update, "Add Business" CTA
- `/merchant/add-business` — multi-step form for creating a new business listing
- `/admin` — admin overview: metrics cards (total businesses, users, enquiries), pending-approval list, user role management table
- All authenticated routes: redirect to auth modal if not logged in

**Todo List:**
1. Build `src/pages/profile/ProfilePage.tsx` — form pre-filled from `GET /api/v1/auth/me`; calls `PUT /api/v1/auth/profile`
2. Build `src/pages/saved/SavedPage.tsx` — 4 tabs; each tab fetches from `GET /api/v1/saved/`; `<SaveToggleButton>` on each card
3. Build `<SaveToggleButton>` — calls `POST /api/v1/saved/` to toggle; optimistic update via React Query mutation
4. Build `src/pages/merchant/MerchantDashboard.tsx` — calls `GET /api/v1/enquiries/merchant/{business_id}`; stats cards (views, calls, enquiries); enquiry table with status selector
5. Build `<EnquiryStatusBadge>` — color-coded: pending=amber, contacted=blue, resolved=green, closed=gray
6. Build `src/pages/merchant/AddBusinessPage.tsx` — multi-step wizard (Basic Info → Location → Contact → Hours → Preview); calls `POST /api/v1/businesses/`
7. Build `src/pages/admin/AdminPage.tsx` — overview metrics; businesses list with Verify/Suspend actions; calls admin endpoints
8. Protect all auth routes with `<ProtectedRoute>` HOC that checks `isAuthenticated` from Zustand

**Relevant Context:**
- `GET /api/v1/saved/` → `{total, businesses[], products[], services[], offers[]}`
- `POST /api/v1/saved/` → `{item_type: 'business'|'product'|'service'|'offer', item_id}`
- `GET /api/v1/enquiries/merchant/{business_id}` → `{business, enquiries[]}`
- `PUT /api/v1/enquiries/{enquiry_id}/status` → `{status: 'pending'|'contacted'|'resolved'}`
- Admin endpoints require `user.role === 'admin'`

---

### Sub-Task 10 — SEO, PWA Finalization & Performance Optimization

**Status:** `[ ] pending`

**Intent:**
Complete the SEO layer (sitemap, robots.txt, structured data), finalize the PWA manifest and service worker, implement performance optimizations (lazy loading, image optimization, bundle splitting), and run Lighthouse audits to achieve 90+ scores.

**Expected Outcomes:**
- `public/sitemap.xml` with static routes; `public/robots.txt` allowing all crawlers
- `index.html` base Open Graph and Twitter Card meta tags
- Each page has unique `<title>`, `<meta name="description">`, canonical URL
- Structured data JSON-LD: `WebSite`, `Organization`, `LocalBusiness` (on business pages), `Product` (on product pages), `Event` (on event pages)
- PWA: passes "Add to Home Screen" criteria — manifest, HTTPS (or localhost), service worker, icons (192×192, 512×512)
- Offline fallback page shown when network unavailable
- All images use `loading="lazy"` and `width/height` attributes to prevent CLS
- Route-level code splitting — each page is a separate JS chunk
- Core Web Vitals targets: LCP < 2.5s, FID < 100ms, CLS < 0.1

**Todo List:**
1. Write `public/robots.txt` — `User-agent: * / Allow: /`
2. Generate `public/sitemap.xml` with all static page paths
3. Finalize `index.html` — base Open Graph (og:title, og:description, og:image, og:type), Twitter Card, theme-color meta
4. Create `src/components/shared/SEOMeta.tsx` — accepts `{title, description, canonical, image, schema}` props; uses `react-helmet-async`
5. Add JSON-LD schemas: `WebSite` on home, `LocalBusiness` on `/businesses/:slug`, `Product` on `/products/:id`, `Event` on `/events/:id`
6. Verify PWA manifest — `short_name`, `name`, `icons` (192 + 512 png), `start_url`, `display: standalone`, `theme_color`
7. Configure Workbox in `vite.config.ts` — cache API responses (`/api/v1/intelligence/*`) with `stale-while-revalidate`; cache static assets with `cache-first`
8. Add `src/pages/Offline.tsx` — fallback page served by service worker when network fails
9. Audit all `<img>` tags — add `loading="lazy"`, explicit `width` + `height`
10. Verify all route components are wrapped in `React.lazy` + `<Suspense fallback={<PageSkeleton />}>`
11. Run `npm run build` + Lighthouse CI — target 90+ performance, 100 SEO, 90+ accessibility, 100 best practices

**Relevant Context:**
- `vite-plugin-pwa` uses Workbox under the hood; configure via `workbox.runtimeCaching` in `VitePWA({})`
- `react-helmet-async` is SSR-safe and handles concurrent renders correctly
- Tailwind's `purge` (content) config must include all `src/**/*.{ts,tsx}` paths to tree-shake unused CSS

---

## Mobile vs Desktop UI Strategy

| Element | Mobile (< 768px) | Desktop (≥ 768px) |
|---|---|---|
| Navigation | Bottom tab bar (5 items) + hamburger sheet | Fixed top navbar + collapsible left sidebar |
| Map | Full-screen, layer toggles as bottom-sheet | Split-pane: map + sidebar list |
| Business cards | Single-column vertical stack | 2-3 column CSS Grid |
| Product filters | Slide-up filter sheet (modal) | Sticky left filter panel |
| Merchant dashboard | Tabbed mobile cards | Data table with sortable columns |
| AQI gauge | Compact circular badge in status strip | Full-width arc gauge with pollutant table |
| AI assistant | Chat-style full screen | 60%-width chat panel with context sidebar |
| Auth modal | Full-screen takeover | Centered dialog (max-w-md) |

## Design Tokens

| Token | Value | Usage |
|---|---|---|
| `brand-50` | `#E8F5EE` | Light green tint backgrounds |
| `brand-500` | `#1A5C38` | Primary buttons, active nav |
| `brand-700` | `#0F3D25` | Hover states, dark accents |
| `gold-400` | `#C9A84C` | Accent badges, highlights, CTA borders |
| `gold-600` | `#A07A2A` | Hover gold |
| `surface` | `#FAF7F0` | Page background (warm off-white) |
| `danger` | `#DC2626` | Emergency page, severe alerts |
| `warning` | `#D97706` | Major incidents, high severity |

## SEO Strategy

- **Static pages** (`/`, `/businesses`, `/products`, etc.) — pre-defined descriptive meta titles and descriptions
- **Dynamic pages** (`/businesses/:slug`, `/products/:id`) — populated from API response fields (name, description, locality)
- **Structured data** — JSON-LD for LocalBusiness, Product, Event, and WebSite/Organization at the app root
- **Canonical URLs** — every page has a `<link rel="canonical">` to prevent duplicate content
- **Sitemap** — `public/sitemap.xml` listing all static routes; search engines can crawl freely
- **robots.txt** — open crawling, block only `/admin/*` and `/api/*`
- **Performance as SEO signal** — Lighthouse 90+ score directly improves Core Web Vitals ranking
- **i18n SEO** — `<html lang="en">` or `<html lang="hi">` set dynamically; `hreflang` alternates for English / Hindi versions
