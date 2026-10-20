# ==============================================================================
# Multi-Stage Dockerfile for Lyka Realty AI Real Estate Platform
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build the client assets and server bundle
# ------------------------------------------------------------------------------
FROM node:22-slim AS builder

WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies needed for Vite & TypeScript build)
RUN npm ci

# Copy application source code
COPY . .

# Build Vite frontend and esbuild server bundle into dist/
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Production runtime image (lightweight & secure)
# ------------------------------------------------------------------------------
FROM node:22-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install only production dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled build output from the builder stage
COPY --from=builder /app/dist ./dist

# Copy public static assets (favicon.ico, logo.png, etc.)
COPY --from=builder /app/public ./public

# Copy runtime configuration files
COPY firebase-applet-config.json ./
COPY portal-credentials.json* ./
COPY src/data ./src/data

# Expose server port (default 3000)
EXPOSE 3000

# Container health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 3000) + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Start the production server
CMD ["node", "dist/server.js"]
