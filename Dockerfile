# Stage 1: Build
# To update digest: docker pull node:20-slim && docker inspect node:20-slim --format='{{index .RepoDigests 0}}'
FROM node:20-slim@sha256:c6585df72c34172bebd8d36abed961e231d7d3b5cee2e01294c4495e8a03f687 AS builder
RUN corepack enable
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @halo/shared build
RUN pnpm --filter @halo/api build
RUN pnpm prune --prod

# Stage 2: Production
FROM node:20-slim@sha256:c6585df72c34172bebd8d36abed961e231d7d3b5cee2e01294c4495e8a03f687 AS runner
RUN corepack enable
WORKDIR /app
ENV NODE_ENV=production

# Run as non-root user for security
RUN addgroup --system --gid 1001 halo && \
    adduser --system --uid 1001 --ingroup halo halo

COPY --from=builder --chown=halo:halo /app/node_modules ./node_modules
COPY --from=builder --chown=halo:halo /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=halo:halo /app/apps/api/src/db/migrations ./apps/api/src/db/migrations
COPY --from=builder --chown=halo:halo /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder --chown=halo:halo /app/apps/api/package.json ./apps/api/
COPY --from=builder --chown=halo:halo /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder --chown=halo:halo /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=builder --chown=halo:halo /app/packages/shared/package.json ./packages/shared/

USER halo
EXPOSE 3000
CMD ["node", "apps/api/dist/server.js"]
