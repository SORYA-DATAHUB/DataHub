import re
import time
import uuid
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager
from datetime import UTC, datetime

import structlog
from fastapi import FastAPI, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from datahub.core.config import Settings, get_settings
from datahub.core.errors import install_error_handlers
from datahub.core.logging import configure_logging
from datahub.core.readiness import dependency_checks

REQUEST_ID_RE = re.compile(r"^[A-Za-z0-9._-]{1,64}$")


class Health(BaseModel):
    status: str
    version: str
    time: datetime


class Readiness(BaseModel):
    status: str
    checks: dict[str, str]


def create_app(settings: Settings | None = None) -> FastAPI:
    config = settings or get_settings()
    configure_logging(config.log_level)
    log = structlog.get_logger("datahub.api")

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        log.info("application_started", version=config.version, environment=config.env)
        yield
        log.info("application_stopped")

    app = FastAPI(title="DataHub API", version=config.version, docs_url="/docs", lifespan=lifespan)
    app.state.settings = config
    install_error_handlers(app)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[config.frontend_origin],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "X-CSRF-Token", "X-Request-ID", "Idempotency-Key", "If-Match"],
    )

    @app.middleware("http")
    async def request_context(
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        supplied = request.headers.get("X-Request-ID", "")
        request_id = supplied if REQUEST_ID_RE.fullmatch(supplied) else f"req_{uuid.uuid4().hex}"
        request.state.request_id = request_id
        started = time.perf_counter()
        structlog.contextvars.bind_contextvars(request_id=request_id)
        try:
            response: Response = await call_next(request)
            response.headers["X-Request-ID"] = request_id
            response.headers["X-Content-Type-Options"] = "nosniff"
            response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
            log.info(
                "request_completed",
                method=request.method,
                route=request.url.path,
                status=response.status_code,
                duration_ms=round((time.perf_counter() - started) * 1000, 2),
            )
            return response
        finally:
            structlog.contextvars.clear_contextvars()

    @app.get("/api/v1/healthz", response_model=Health, tags=["Health"])
    async def healthz() -> Health:
        return Health(status="ok", version=config.version, time=datetime.now(UTC))

    @app.get("/api/v1/readyz", response_model=Readiness, tags=["Health"])
    async def readyz(response: Response) -> Readiness:
        checks = dependency_checks(config)
        ready = all(value == "ok" for value in checks.values())
        response.status_code = status.HTTP_200_OK if ready else status.HTTP_503_SERVICE_UNAVAILABLE
        return Readiness(status="ok" if ready else "error", checks=dict(checks))

    return app


app = create_app()
