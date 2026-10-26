import asyncio

import httpx

from datahub.core.config import Settings
from datahub.main import create_app


async def request_health(request_id: str) -> httpx.Response:
    app = create_app(Settings(env="test"))
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        return await client.get("/api/v1/healthz", headers={"X-Request-ID": request_id})


def test_health_has_request_id_and_security_headers() -> None:
    response = asyncio.run(request_health("test_request_1"))
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.headers["x-request-id"] == "test_request_1"
    assert response.headers["x-content-type-options"] == "nosniff"


def test_invalid_request_id_is_replaced() -> None:
    response = asyncio.run(request_health("contains spaces"))
    assert response.headers["x-request-id"].startswith("req_")
