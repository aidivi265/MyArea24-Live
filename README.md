# MyArea24 — AI-Powered Local Intelligence Network for India

**MyArea24** is an AI-powered Local Intelligence Network engineered specifically for India. Rather than presenting fragmented dashboards of weather, traffic, and news, MyArea24 connects hyper-local data streams, evaluates cross-signal intersections using deterministic rules, and delivers grounded, evidence-backed recommendations.

---

## Current Status: Milestone 2.0 Completed (Local Intelligence Engine)

Milestone 2.0 delivers the core intelligence layer for MyArea24, connecting normalized signals across WeatherAPI, TomTom Traffic v5, and NDMA SACHET CAP v1.2 into grounded, evidence-backed local insights.

### Validated Capabilities:
- **Scenario A (Weather + Traffic Correlation):** Multi-signal spatiotemporal intersection detecting compound commute hazards with categorical confidence levels and uncertainty notes.
- **Scenario B (Severe Public Alert):** Connects NDMA SACHET OASIS CAP v1.2 disaster warnings to pilot localities via ray-casting polygon intersection, circle proximity, and text matching; extracts official instructions.
- **Scenario C (Single-Signal Notices):** Surfaces standalone high-severity traffic incidents or extreme cloudburst downpours as explicit single-source notices without fabricating false multi-source corroboration.
- **Ray-Casting Point-in-Polygon Engine:** Pure-Python GeoJSON polygon intersection for CAP emergency boundaries without heavy binary C-dependencies.
- **Generalized Deduplication:** SHA-256 deduplication hashing preventing redundant insight emissions across all scenarios.
- **Multi-Attribute Intelligence API:** Filter by `area`, `insight_type`, `severity`, and `confidence` with pagination and sorting.
- **81 Automated Tests Passing:** 100% test coverage across rules, geometry matching, coordinate validity, stale/expired record gating, and API contracts.

---

## Quick Start Guide

### 1. Prerequisites
- Python 3.11+ (Tested on Python 3.14)
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

### 5. Run the Automated Test Suite
```bash
.\.venv\Scripts\pytest.exe -v
```

### 6. Start the Local API Server
```bash
.\.venv\Scripts\uvicorn.exe backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```
- API Documentation (Swagger): `http://127.0.0.1:8000/docs`
- Health Check: `http://127.0.0.1:8000/health`
- Readiness Check: `http://127.0.0.1:8000/ready`
- Intelligence Feed: `http://127.0.0.1:8000/api/v1/intelligence`

### 7. Run Ingestion Workers & Smoke Tests
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
