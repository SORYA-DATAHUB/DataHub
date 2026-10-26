import socket
from typing import Literal

import boto3
import redis
from botocore.config import Config
from sqlalchemy import text

from datahub.core.config import Settings
from datahub.core.db import engine

CheckStatus = Literal["ok", "error"]


def _tcp(host: str, port: int, timeout: float = 1.5) -> CheckStatus:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return "ok"
    except OSError:
        return "error"


def dependency_checks(settings: Settings) -> dict[str, CheckStatus]:
    checks: dict[str, CheckStatus] = {}
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        checks["postgres"] = "ok"
    except Exception:
        checks["postgres"] = "error"
    try:
        redis_client = redis.Redis.from_url(settings.redis_url)
        checks["redis"] = "ok" if redis_client.ping() else "error"
    except Exception:
        checks["redis"] = "error"
    try:
        client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint_url,
            region_name=settings.s3_region,
            aws_access_key_id=settings.s3_access_key,
            aws_secret_access_key=settings.s3_secret_key.get_secret_value(),
            config=Config(connect_timeout=1, read_timeout=1, retries={"max_attempts": 0}),
        )
        client.head_bucket(Bucket=settings.s3_bucket)
        checks["s3"] = "ok"
    except Exception:
        checks["s3"] = "error"
    checks["clamav"] = _tcp(settings.clamav_host, settings.clamav_port)
    return checks
