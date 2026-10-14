# ==========================================
# Multi-Stage Dockerfile for UnlazyNotes
# Astro Fullstack (Node.js Standalone Adapter)
# ==========================================

# Stage 1: Build application assets
FROM node:22-alpine AS builder

WORKDIR /app
RUN apk add --no-cache libc6-compat

COPY .npmrc* ./
COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY . .
ENV NODE_ENV=production
RUN npm run build

# Stage 2: Production Runner Image
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321

RUN apk add --no-cache wget

# Install only production dependencies for minimal image size
COPY .npmrc* ./
COPY package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps

# Copy compiled distribution output & migrations from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts

# Secure permissions for non-root node user
RUN chown -R node:node /app

USER node

EXPOSE 4321

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:4321/ || exit 1

CMD ["node", "./dist/server/entry.mjs"]
