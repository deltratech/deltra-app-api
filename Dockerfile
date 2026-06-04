FROM node:24-alpine AS base
WORKDIR /app
COPY package*.json ./

FROM base AS development
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npx prisma generate --schema=prisma/tenant/schema.prisma
CMD ["npm", "run", "start:dev"]

FROM base AS builder
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npx prisma generate --schema=prisma/tenant/schema.prisma
RUN npm run build

FROM node:24-alpine AS production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
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
