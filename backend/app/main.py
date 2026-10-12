import asyncio
import contextlib
import sys

if sys.platform == "win32":
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    except Exception:
        pass

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from backend.app.core.config import settings
from backend.app.core.errors import MyArea24Error
from backend.app.core.logging import logger
from backend.app.database.session import Base, engine
from backend.app.api.health import router as health_router
from backend.app.api.intelligence import router as intelligence_router
from backend.app.api.auth import router as auth_router
from backend.app.api.businesses import router as businesses_router
from backend.app.api.products import router as products_router
from backend.app.api.services import router as services_router
from backend.app.api.offers import router as offers_router
from backend.app.api.events import router as events_router
from backend.app.api.enquiries import router as enquiries_router
from backend.app.api.saved import router as saved_router
from backend.app.api.admin import router as admin_router
from backend.app.api.market import router as market_router
from backend.app.api.locations import router as locations_router
from backend.app.api.emergency import router as emergency_router
from backend.app.ingestion.scheduler import scheduler


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Ensure tables exist
    logger.info(f"Starting {settings.APP_NAME} in [{settings.APP_ENV}] mode...")

    # Production security validation
    if (settings.APP_ENV or "").strip().lower() in ["production", "prod"]:
        default_insecure_key = "myarea24_local_development_secret_key_2026"
        if not settings.JWT_SECRET_KEY or default_insecure_key in settings.JWT_SECRET_KEY:
            logger.critical("FATAL: Application cannot start in production with default JWT_SECRET_KEY!")
            raise RuntimeError(
                "CRITICAL SECURITY CONFIGURATION ERROR: Default JWT_SECRET_KEY cannot be used in production mode!"
            )
    Base.metadata.create_all(bind=engine)

    # Schema evolution: ensure newly added columns are present in existing SQLite databases
    from sqlalchemy import inspect, text
    with engine.connect() as conn:
        inspector = inspect(conn)
        if inspector.has_table("events"):
            existing_cols = {c["name"] for c in inspector.get_columns("events")}
            new_event_cols = [
                ("expected_attendance", "INTEGER DEFAULT 500"),
                ("parking_pressure", "VARCHAR(50) DEFAULT 'MODERATE'"),
                ("arterial_traffic_impact", "VARCHAR(50) DEFAULT 'MODERATE'"),
                ("exit_weather_advisory", "VARCHAR(255)"),
                ("correlated_commute_route", "VARCHAR(255)"),
            ]
            for col_name, col_type in new_event_cols:
                if col_name not in existing_cols:
                    try:
                        conn.execute(text(f"ALTER TABLE events ADD COLUMN {col_name} {col_type}"))
                        conn.commit()
                        logger.info(f"[main] Migrated schema: added column {col_name} to events table")
                    except Exception as e:
                        logger.warning(f"[main] Column migration notice for {col_name}: {e}")

        if inspector.has_table("service_listings"):
            existing_svc_cols = {c["name"] for c in inspector.get_columns("service_listings")}
            if "is_available" not in existing_svc_cols:
                try:
                    conn.execute(text("ALTER TABLE service_listings ADD COLUMN is_available BOOLEAN DEFAULT 1"))
                    conn.commit()
                    logger.info("[main] Migrated schema: added column is_available to service_listings table")
                except Exception as e:
                    logger.warning(f"[main] Column migration notice for service_listings.is_available: {e}")

    # Start background ingestion worker scheduler if enabled
    if settings.INGESTION_ENABLED:
        scheduler.start()
    else:
        logger.info("[main] INGESTION_ENABLED=false. Background polling is inactive.")

    yield

    # Shutdown: Stop worker gracefully
    logger.info(f"Shutting down {settings.APP_NAME}...")
    await scheduler.stop()


app = FastAPI(
    title="MyArea24 — Local Intelligence Engine",
    description="Headless backend and deterministic correlation engine for local intelligence in India.",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

# CORS Middleware (Compliant with W3C Fetch Specification)
# Modern browsers reject credentialed requests when allow_origins=["*"] is paired with allow_credentials=True.
cors_origins = settings.cors_origins
has_wildcard = "*" in cors_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins if not has_wildcard else ["*"],
    allow_origin_regex=settings.ALLOWED_ORIGIN_REGEX if not has_wildcard else None,
    allow_credentials=not has_wildcard,
    allow_methods=["*"],
    allow_headers=["*"],
)

# High-Performance GZip Compression for payloads >= 500 bytes (80-90% bandwidth reduction)
app.add_middleware(GZipMiddleware, minimum_size=500)


@app.middleware("http")
async def add_performance_cache_headers(request: Request, call_next):
    """
    Adds browser HTTP cache-control headers to safe GET requests to enable
    0ms instant loads from browser disk/memory cache.
    """
    response = await call_next(request)
    if request.method == "GET" and response.status_code == 200:
        path = request.url.path
        if any(p in path for p in ["/location/states", "/location/districts", "/categories"]):
            response.headers["Cache-Control"] = "public, max-age=600, stale-while-revalidate=1200"
        elif any(p in path for p in ["/fuel-rates", "/market-rates", "/bulletins", "/snapshot"]):
            response.headers["Cache-Control"] = "public, max-age=180, stale-while-revalidate=360"
        elif any(p in path for p in ["/weather", "/air-quality", "/traffic", "/events", "/offers"]):
            response.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=180"
    return response

# Exception Handlers
@app.exception_handler(MyArea24Error)
async def custom_error_handler(request: Request, exc: MyArea24Error):
    logger.error(f"Application error handling {request.url.path}: {exc.message}")
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"error": exc.__class__.__name__, "message": exc.message, "details": exc.details},
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception(f"Unhandled exception on {request.url.path}: {str(exc)}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"error": "InternalServerError", "message": "An unexpected server error occurred."},
    )


# Register Routers
app.include_router(health_router)
app.include_router(intelligence_router)
app.include_router(auth_router)
app.include_router(businesses_router)
app.include_router(products_router)
app.include_router(services_router)
app.include_router(offers_router)
app.include_router(events_router)
app.include_router(enquiries_router)
app.include_router(saved_router)
app.include_router(admin_router)
app.include_router(market_router)
app.include_router(locations_router)
app.include_router(emergency_router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
