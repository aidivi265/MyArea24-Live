# MyArea24 — Pan-India MVP Quickstart Guide
**AI-Powered Hyperlocal Intelligence, Civic Action & Commerce Network**

---

## ⚡ 1-Minute Launch (Docker Compose)

Deploy the full stack (FastAPI backend + Vite React PWA + Nginx) with a single command:

```bash
docker compose up --build -d
```

- **Frontend App:** http://localhost:80
- **Backend API & Swagger Docs:** http://localhost:8000/docs
- **Admin Console:** http://localhost:80/admin

---

## 💻 Local Development Setup

### Prerequisites
- Python 3.11+
- Node.js 20+
- SQLite3

### 1. Backend Setup
```bash
# Activate virtual environment
python -m venv .venv
# Windows: .venv\Scripts\activate
# Linux/macOS: source .venv/bin/activate

# Install dependencies in editable mode
pip install -e .

# Configure environment
cp .env.example .env
```

### 2. Seed Database with Realistic Pan-India Data
Populates 780+ district spatial index, local businesses, price comparisons, active offers, mandi rates, civic bulletins, emergency hospitals, and community ground-truth signals:

```bash
python scripts/seed_marketplace_data.py
```

### 3. Start Backend Server
```bash
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```
API Documentation: http://localhost:8000/docs

### 4. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Open: http://localhost:5174

---

## 🧭 Testing & Quality Verification

Run the full automated test suite (148 tests across unit & end-to-end integration):

```bash
# Run backend test suite
pytest tests/unit tests/integration -q

# Run specific E2E lifecycle test
pytest tests/integration/test_pan_india_e2e_lifecycle.py -v

# Run frontend production build & TypeScript validation
npm --prefix frontend run build
```

---

## 🚀 Key Pan-India Features Implemented

1. **Pan-India Spatial KD-Tree Engine (780+ Districts)**:
   - Zero-latency district resolution, state hierarchy, and reverse-geocoding fallbacks (`/api/v1/location/*`).
2. **Interactive Multi-Layer GIS Map (`/map`)**:
   - 5 independent Leaflet overlay layers: Verified Businesses, Air Quality AQI Stations, Traffic Incidents, Civic Bulletins, and Emergency Facilities.
3. **National Highway Safety & Expressway SOS**:
   - National Emergency (112), Medical (108), NHAI Expressway Helpline (1033), NDMA (1078), SDMA (1070), and Indian Coast Guard (1554).
4. **Disaster Crisis Protocol (Red Alert Banner)**:
   - Immediate platform-wide alert bar triggered during IMD Red Warnings / NDMA SACHET CAP emergency broadcasts.
5. **Hyperlocal Merchant Demand Radar & Flash Deals (`/merchant`, `/offers`)**:
   - Multi-signal demand forecasting correlating rain, traffic gridlock, and local event crowd surges.
   - 1-click Flash Deal Generator for local shopkeepers to monetize sudden weather/traffic spikes.
6. **Citizen Ground-Truth Civic Action Lifecycle (`/intelligence/community`)**:
   - Community-reported waterlogging, crater potholes, downed trees, and spontaneous street markets.
   - Upvote consensus corroboration and municipal resolution tracking.
7. **Bilingual AI Voice Assistant (English & Hindi)**:
   - Web Speech API integration (`/intelligence/assistant`) with native speech recognition and localized district answers.
8. **Administrative Governance & Moderation Desk (`/admin`)**:
   - Multi-tab portal for store verification, citizen hazard triage, and role administration.
9. **PWA Offline Resilience (`/offline`)**:
   - Service worker pre-caching 62 assets.
   - Direct offline speed-dials (112, 108, 1033) functional even without cellular data.

---

## 🔐 Demo Credentials & User Roles

- **Super Administrator:** `admin@myarea24.in` (Access `/admin`)
- **Demo Merchant:** `electronics@connaught.in` (Access `/merchant`)
- **Citizen / Resident:** Log in with any email via passwordless OTP (dev OTP is printed on screen when `OTP_DEV_MODE=true`).
