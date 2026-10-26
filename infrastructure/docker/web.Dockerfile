FROM node:22.14.0-alpine AS deps
RUN corepack enable && corepack prepare pnpm@10.20.0 --activate
WORKDIR /repo
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS builder
COPY apps/web apps/web
COPY packages/shared packages/shared
RUN pnpm --filter @datahub/web build

FROM node:22.14.0-alpine AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
RUN addgroup --system --gid 10001 datahub && adduser --system --uid 10001 --ingroup datahub datahub
WORKDIR /app
COPY --from=builder --chown=datahub:datahub /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=datahub:datahub /repo/apps/web/.next/static ./apps/web/.next/static
USER datahub
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
