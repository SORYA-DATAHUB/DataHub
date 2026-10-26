"""Sliding-window rate limiter behind a small interface (AUTH_AUTHORIZATION.md section 13).

Keys are hashed before they reach the backend so emails and IPs never appear in Redis keys.
Auth-class limits fail closed when the backend is unavailable.
"""

import hashlib
import threading
import time
import uuid
from collections import defaultdict, deque
from dataclasses import dataclass
from typing import Protocol

import redis
import structlog

from datahub.core.errors import AppError

log = structlog.get_logger("datahub.ratelimit")


@dataclass(frozen=True)
class RateDecision:
    allowed: bool
    remaining: int
    retry_after: int


class RateLimitBackendError(Exception):
    pass


class RateLimiter(Protocol):
    def hit(self, bucket: str, key: str, limit: int, window_seconds: int) -> RateDecision: ...


def _digest(bucket: str, key: str) -> str:
    return f"rl:{bucket}:{hashlib.sha256(key.encode()).hexdigest()}"


class InMemoryRateLimiter:
    """Process-local limiter for tests and single-process development."""

    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def hit(self, bucket: str, key: str, limit: int, window_seconds: int) -> RateDecision:
        name = _digest(bucket, key)
        now = time.monotonic()
        with self._lock:
            hits = self._hits[name]
            while hits and hits[0] <= now - window_seconds:
                hits.popleft()
            if len(hits) >= limit:
                retry = max(1, int(hits[0] + window_seconds - now) + 1)
                return RateDecision(False, 0, retry)
            hits.append(now)
            return RateDecision(True, limit - len(hits), 0)

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


class RedisRateLimiter:
    """Sorted-set sliding window shared by all API replicas."""

    def __init__(self, url: str) -> None:
        self._client: redis.Redis = redis.Redis.from_url(url, socket_timeout=1.0, socket_connect_timeout=1.0)

    def hit(self, bucket: str, key: str, limit: int, window_seconds: int) -> RateDecision:
        name = _digest(bucket, key)
        now = time.time()
        try:
            pipe = self._client.pipeline()
            pipe.zremrangebyscore(name, 0, now - window_seconds)
            pipe.zcard(name)
            pipe.zrange(name, 0, 0, withscores=True)
            _, count, oldest = pipe.execute()
            if count >= limit:
                first = oldest[0][1] if oldest else now
                return RateDecision(False, 0, max(1, int(first + window_seconds - now) + 1))
            pipe2 = self._client.pipeline()
            pipe2.zadd(name, {uuid.uuid4().hex: now})
            pipe2.expire(name, window_seconds + 1)
            pipe2.execute()
            return RateDecision(True, limit - count - 1, 0)
        except redis.RedisError as exc:
            raise RateLimitBackendError("rate limit backend unavailable") from exc


def enforce(
    limiter: RateLimiter,
    bucket: str,
    key: str,
    limit: int,
    window_seconds: int,
    *,
    fail_closed: bool = True,
) -> None:
    """Count one hit. Raises 429 when exceeded, 503 when the backend is down and fail_closed."""
    try:
        decision = limiter.hit(bucket, key, limit, window_seconds)
    except RateLimitBackendError:
        log.error("rate_limit_backend_unavailable", bucket=bucket)
        if fail_closed:
            raise AppError(503, "service_unavailable", "Service temporarily unavailable.") from None
        return
    if not decision.allowed:
        raise AppError(
            429,
            "rate_limited",
            "Too many requests. Try again later.",
            headers={"Retry-After": str(decision.retry_after)},
        )


def allow(limiter: RateLimiter, bucket: str, key: str, limit: int, window_seconds: int) -> bool:
    """Like enforce() but returns False instead of raising (for silently-dropped actions)."""
    try:
        return limiter.hit(bucket, key, limit, window_seconds).allowed
    except RateLimitBackendError:
        return False
