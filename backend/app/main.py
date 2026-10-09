import contextlib
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from backend.app.core.config import settings
from backend.app.core.errors import MyArea24Error
from backend.app.core.logging import logger
from backend.app.database.session import Base, engine
from backend.app.api.health import router as health_router
from backend.app.api.intelligence import router as intelligence_router
from backend.app.ingestion.scheduler import scheduler


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Ensure tables exist
    logger.info(f"Starting {settings.APP_NAME} in [{settings.APP_ENV}] mode...")
    Base.metadata.create_all(bind=engine)

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

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
