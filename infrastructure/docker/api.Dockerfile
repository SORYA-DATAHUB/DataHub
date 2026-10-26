FROM python:3.13.5-slim AS builder
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
RUN pip install --no-cache-dir uv==0.8.22
WORKDIR /app
COPY apps/api/pyproject.toml apps/api/uv.lock* ./
RUN --mount=type=cache,target=/root/.cache/uv uv sync --frozen --no-install-project --no-dev
COPY apps/api/ ./
RUN --mount=type=cache,target=/root/.cache/uv uv sync --frozen --no-dev

FROM python:3.13.5-slim AS runtime
RUN groupadd --system --gid 10001 datahub && useradd --system --uid 10001 --gid datahub --home-dir /app datahub
WORKDIR /app
COPY --from=builder --chown=datahub:datahub /app /app
ENV PATH="/app/.venv/bin:$PATH" PYTHONPATH=/app/src PYTHONUNBUFFERED=1
USER datahub
EXPOSE 8000
CMD ["uvicorn", "datahub.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips=*"]
