from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from starlette.exceptions import HTTPException as StarletteHTTPException


class ErrorBody(BaseModel):
    code: str
    message: str
    details: dict[str, Any] | None = None
    request_id: str


class ErrorEnvelope(BaseModel):
    error: ErrorBody


class AppError(Exception):
    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        details: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
    ):
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details
        self.headers = headers


def _envelope(request: Request, code: str, message: str, details: dict[str, Any] | None) -> dict[str, Any]:
    request_id = getattr(request.state, "request_id", "unknown")
    body = ErrorEnvelope(error=ErrorBody(code=code, message=message, details=details, request_id=request_id))
    return body.model_dump(exclude_none=True)


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_envelope(request, exc.code, exc.message, exc.details),
            headers=exc.headers,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        fields = [
            {"loc": [str(part) for part in err["loc"]], "msg": str(err["msg"]), "type": str(err["type"])}
            for err in exc.errors()
        ]
        return JSONResponse(
            status_code=422,
            content=_envelope(request, "validation_error", "One or more fields are invalid.", {"fields": fields}),
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        mapping = {
            404: ("resource.not_found", "Not found."),
            405: ("request.method_not_allowed", "Method not allowed."),
        }
        code, message = mapping.get(exc.status_code, ("request.malformed", "The request could not be processed."))
        return JSONResponse(
            status_code=exc.status_code,
            content=_envelope(request, code, message, None),
            headers=dict(exc.headers) if exc.headers else None,
        )

    @app.exception_handler(Exception)
    async def unexpected_error_handler(request: Request, _: Exception) -> JSONResponse:
        request_id = getattr(request.state, "request_id", "unknown")
        body = ErrorEnvelope(
            error=ErrorBody(
                code="internal_error",
                message="An unexpected error occurred.",
                request_id=request_id,
            )
        )
        return JSONResponse(status_code=500, content=body.model_dump(exclude_none=True))
