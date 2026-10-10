# MyArea24 — AI-Powered Local Intelligence Network for India

[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-brightgreen?style=for-the-badge&logo=github)](https://aidivi265.github.io/MyArea24/)
[![Tests Passing](https://img.shields.io/badge/Tests-164%20Passing-success?style=for-the-badge)](https://aidivi265.github.io/MyArea24/)

**Live Application Demo:** [https://aidivi265.github.io/MyArea24/](https://aidivi265.github.io/MyArea24/)

**MyArea24** is an AI-powered Local Intelligence Network engineered specifically for India. Rather than presenting fragmented dashboards of weather, traffic, and news, MyArea24 connects hyper-local data streams, evaluates cross-signal intersections using deterministic rules, and delivers grounded, evidence-backed recommendations.

---

## Current Status: Phase 2 Final Submission Readiness (Production Prototype)

MyArea24 is fully verified and ready for evaluation:
- **16 Unified Core Views:** Live Intelligence Feed (`#/dashboard`), Location Detection (`#/location`), Ask MyArea24 Grounded AI Assistant (`#/assistant`), Interactive Corridor Map (`#/map`), Weather Telemetry (`#/weather`), Traffic Bottlenecks (`#/traffic`), Air Quality (`#/air-quality`), Government Alerts (`#/alerts`), Health & Emergency 112 (`#/emergency`), Civic Events (`#/events`), Local News (`#/news`), Civic Directory (`#/businesses`), Mandi Prices (`#/market`), Saved Items (`#/saved`), Settings & Audit (`#/settings`), and Global Search (`#/search`).
- **Browser Geolocation & Offline Storage:** Robust device GPS detection (`navigator.geolocation`) reverse-resolving coordinates via haversine distance to the nearest Indian corridor with `localStorage` (`myarea24_selected_location`) persistence and zero silent location spoofing.
- **Grounded AI Assistant:** Evidence-backed Q&A engine querying real SQLite database records (WeatherAPI, TomTom v5, NDMA SACHET, CPCB) with verified source provenance and confidence ratings.
- **Zero Synthetic Data Compliance:** Strict honesty pledge: unmonitored locations and pending integrations display explicit `UNAVAILABLE` or `AWAITING_CONFIG` states with zero hallucinations.
- **Submission Freeze Mode:** `INGESTION_ENABLED=false` enforced in `.env` to prevent background quota consumption while reliably serving 435+ persisted database records.
- **164 Total Automated Tests Passing:**
  - **115 Backend Tests Passing** (`pytest -v`)
  - **34 Frontend Unit & Component Tests Passing** (`vitest run --run`)
  - **15 Browser E2E Flows Passing** (`node frontend/scripts/e2e_browser_test.mjs`) with zero console errors and 13 screenshot captures.
  - **Vite Production Build:** Clean build in 322ms.
- **Full Verification Report:** See [`docs/phase-2/submission-checklist.md`](docs/phase-2/submission-checklist.md).

---

## Quick Start Guide

### 1. Prerequisites
- Python 3.11+ (Tested on Python 3.14)
- Node.js 18+ & npm 9+ (Tested on Node v26)
- Git

### 2. Environment Setup
```bash
# Clone the repository and enter the directory
cd AKGEC

# Create and activate virtual environment
python -m venv .venv
.\.venv\Scripts\activate   # On Windows
# source .venv/bin/activate # On Linux/macOS

# Install dependencies
pip install -e .
pip install pytest pytest-asyncio
```

### 3. Configure Environment Variables
Copy the configuration template and populate optional provider keys:
```bash
cp .env.example .env
```
*(Note: Automated tests run 100% offline using synthetic fixtures and do not require external API keys).*

### 4. Apply Database Migrations
```bash
.\.venv\Scripts\alembic.exe upgrade head
```

### 5. Run the Automated Test Suites
```bash
# Run backend pytest suite (115 tests):
.\.venv\Scripts\pytest.exe -v

# Run frontend Vitest suite (34 tests):
npm --prefix frontend test -- --run

# Run full Headless Chrome E2E browser suite (15 flows, 13 screenshots):
node frontend/scripts/e2e_browser_test.mjs
```

### 6. Start the Local API Server
```bash
.\.venv\Scripts\uvicorn.exe backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```
- API Documentation (Swagger): `http://127.0.0.1:8000/docs`
- Health Check: `http://127.0.0.1:8000/health`
- Readiness Check: `http://127.0.0.1:8000/ready`
- Intelligence Feed: `http://127.0.0.1:8000/api/v1/intelligence`

### 7. Start the Frontend Web Application
```bash
# Navigate to frontend and start Vite development server:
cd frontend
npm install
npm run dev
```
The interface is accessible at `http://localhost:5173`.
To build the production bundle:
```bash
npm run build
```

### 8. Run Ingestion Workers & Smoke Tests
```bash
# Run a single ingestion & correlation cycle:
.\.venv\Scripts\python.exe scripts/run_worker.py --once

# Run continuous background daemon:
.\.venv\Scripts\python.exe scripts/run_worker.py --interval 600

# Run live provider connectivity smoke test (requires keys in .env):
.\.venv\Scripts\python.exe scripts/smoke_test_live.py
```

---

## Documentation Index

### Phase 0: Feasibility & Strategic Foundations
- [`docs/phase-0/product-validation.md`](file:///c:/Users/divya/OneDrive/Desktop/AKGEC/docs/phase-0/product-validation.md) — Problem statement, personas, and principles.
- [`docs/phase-0/mvp-scope.md`](file:///c:/Users/divya/OneDrive/Desktop/AKGEC/docs/phase-0/mvp-scope.md) — Module classification and smallest viable MVP.
- [`docs/phase-0/india-data-source-research.md`](file:///c:/Users/divya/OneDrive/Desktop/AKGEC/docs/phase-0/india-data-source-research.md) — Provider audit, legal terms, and rate limits.
- [`docs/phase-0/api-feasibility-matrix.md`](file:///c:/Users/divya/OneDrive/Desktop/AKGEC/docs/phase-0/api-feasibility-matrix.md) — 1–5 scored provider comparison matrix.
- [`docs/phase-0/intelligence-scenarios.md`](file:///c:/Users/divya/OneDrive/Desktop/AKGEC/docs/phase-0/intelligence-scenarios.md) — Intelligence scenarios and correlation logic.
- [`docs/phase-0/cost-estimates.md`](file:///c:/Users/divya/OneDrive/Desktop/AKGEC/docs/phase-0/cost-estimates.md) — INR operating cost models (₹100/mo to ₹808/mo).
- [`docs/phase-0/risk-register.md`](file:///c:/Users/divya/OneDrive/Desktop/AKGEC/docs/phase-0/risk-register.md) — DPDPA compliance, privacy, and architectural mitigations.
- [`docs/phase-0/phase-0-decision.md`](file:///c:/Users/divya/OneDrive/Desktop/AKGEC/docs/phase-0/phase-0-decision.md) — Final CONDITIONAL GO sign-off report.

### Phase 1: Ingestion & Backend Engine
- [`docs/phase-1/architecture.md`](file:///c:/Users/divya/OneDrive/Desktop/AKGEC/docs/phase-1/architecture.md) — Modular monolith system architecture.
- [`docs/phase-1/data-model.md`](file:///c:/Users/divya/OneDrive/Desktop/AKGEC/docs/phase-1/data-model.md) — PostgreSQL / SQLite schema specifications for all 7 tables.
- [`docs/phase-1/provider-setup.md`](file:///c:/Users/divya/OneDrive/Desktop/AKGEC/docs/phase-1/provider-setup.md) — External provider onboarding and API keys.
- [`docs/phase-1/sachet-validation-report.md`](file:///c:/Users/divya/OneDrive/Desktop/AKGEC/docs/phase-1/sachet-validation-report.md) — NDMA SACHET feed resolution and data readiness validation report.
- [`docs/phase-1/correlation-rules.md`](file:///c:/Users/divya/OneDrive/Desktop/AKGEC/docs/phase-1/correlation-rules.md) — Deterministic mathematical specification of Scenario D.
- [`docs/phase-1/testing.md`](file:///c:/Users/divya/OneDrive/Desktop/AKGEC/docs/phase-1/testing.md) — Automated test suite and 24-hour soak-test procedure.
- [`docs/phase-1/operations.md`](file:///c:/Users/divya/OneDrive/Desktop/AKGEC/docs/phase-1/operations.md) — Solo-founder operational procedures and quota safety.

### Milestone 2: Intelligence Engine
- [`docs/phase-1/intelligence-engine-gap-analysis.md`](file:///c:/Users/divya/OneDrive/Desktop/AKGEC/docs/phase-1/intelligence-engine-gap-analysis.md) — System audit, feature matrix, and architectural blueprint.
- [`docs/phase-1/intelligence-engine-report.md`](file:///c:/Users/divya/OneDrive/Desktop/AKGEC/docs/phase-1/intelligence-engine-report.md) — Milestone 2.0 validation report, rule thresholds, and test evidence.

### Milestone 3: MVP Web Interface & End-to-End QA
- [`docs/phase-1/mvp-interface-report.md`](file:///c:/Users/divya/OneDrive/Desktop/AKGEC/docs/phase-1/mvp-interface-report.md) — Milestone 3.0 interface implementation report, component architecture, audit of live records, and contract verification.
- [`docs/phase-1/end-to-end-qa-report.md`](file:///c:/Users/divya/OneDrive/Desktop/AKGEC/docs/phase-1/end-to-end-qa-report.md) — Milestone 3.1 end-to-end QA report, browser automation verification results, live API tests, and GO/NO-GO deployment recommendation.
