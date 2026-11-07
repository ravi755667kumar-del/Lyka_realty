# syntax=docker/dockerfile:1

# ─── Stage 1: Base Alpine Image ───
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

# ─── Stage 2: Install Dependencies ───
FROM base AS deps
WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps

# ─── Stage 3: Build Next.js Application ───
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Disable Next.js telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Compile standalone production build
RUN npm run build

# ─── Stage 4: Production Runner ───
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

# Create secure non-root system user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy static assets and knowledge base datasets
COPY --from=builder /app/public ./public
COPY --from=builder /app/datasets ./datasets

# Copy standalone server and static files with correct user permissions
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3001

CMD ["node", "server.js"]
