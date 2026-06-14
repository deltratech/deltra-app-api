# syntax=docker/dockerfile:1
FROM node:24-alpine AS base
WORKDIR /app
ENV DATABASE_URL="postgresql://postgres:postgres@localhost:5432/deltra?schema=public"
COPY package*.json ./

FROM base AS development
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
RUN npx prisma generate && npx prisma generate --schema=prisma/tenant/schema.prisma
CMD ["npm", "run", "start:dev"]

FROM base AS builder
# sharing=locked: serialize with the production stage's npm ci so the package
# tarballs are downloaded ONCE into the shared cache, not twice in parallel.
RUN --mount=type=cache,target=/root/.npm,sharing=locked npm ci
COPY . .
RUN npx prisma generate && npx prisma generate --schema=prisma/tenant/schema.prisma
RUN npm run build

FROM node:24-alpine AS production
WORKDIR /app
COPY package*.json ./
# Reuses the warm npm cache populated by the builder stage → installs from disk,
# no network re-download.
RUN --mount=type=cache,target=/root/.npm,sharing=locked npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/tsconfig.seed.json ./tsconfig.seed.json
# Preserve the generated engine binaries (skipped by tsc, stripped by npm ci --omit=dev)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
# Seed scripts run through ts-node in production, so keep the pinned compiler available.
COPY --from=builder /app/node_modules/typescript ./node_modules/typescript
CMD ["sh", "-c", "npm run db:bootstrap && node dist/main"]
