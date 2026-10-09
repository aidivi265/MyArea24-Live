# MyArea24 — AI-Powered Local Intelligence Network for India

**MyArea24** is an AI-powered Local Intelligence Network engineered specifically for India. Rather than presenting fragmented dashboards of weather, traffic, and news, MyArea24 connects hyper-local data streams, evaluates cross-signal intersections using deterministic rules, and delivers grounded, evidence-backed recommendations.

---

## Current Status: Milestone 1 Completed (Core Signal Ingestion & Normalization Engine)

Milestone 1 establishes the headless signal ingestion, normalization, database persistence, and deterministic cross-signal correlation engine without mobile UI or LLM dependencies.

### Validated Capabilities:
- **WeatherAPI Integration:** Real-time and hourly forecast ingestion with 60-minute in-memory caching.
- **TomTom Traffic v5 Integration (Primary):** Live incident, delay, and road congestion ingestion across configured pilot bounding boxes (`TOMTOM_API_KEY`).
- **HERE Traffic v7 Integration (Alternative):** Compatible fallback provider selectable via `TRAFFIC_PROVIDER="here"`.
- **NDMA SACHET Integration:** Safe OASIS CAP v1.2 XML parsing with GeoJSON polygon extraction and entity-attack protection.
- **Deterministic Correlation Engine:** Evaluates **Scenario D (Monsoon Commute & Congestion)** using pure-Python Haversine proximity, time-window checking, and compound thresholds (compatible with TomTom delay/criticality and HERE jamFactor).
- **Full Signal Provenance:** Every emitted intelligence insight embeds its supporting raw observation IDs, timestamps, and confidence scores.
- **Zero Duplicate Storage:** Idempotent ingestion and SHA-256 deduplication hash indexing.
- **48 Automated Tests Passing:** 100% test coverage across normalization, CAP parsing, correlation rules, database persistence, and API contracts.

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
- [`docs/phase-1/correlation-rules.md`](file:///c:/Users/divya/OneDrive/Desktop/AKGEC/docs/phase-1/correlation-rules.md) — Deterministic mathematical specification of Scenario D.
- [`docs/phase-1/testing.md`](file:///c:/Users/divya/OneDrive/Desktop/AKGEC/docs/phase-1/testing.md) — Automated test suite and 24-hour soak-test procedure.
- [`docs/phase-1/operations.md`](file:///c:/Users/divya/OneDrive/Desktop/AKGEC/docs/phase-1/operations.md) — Solo-founder operational procedures and quota safety.
