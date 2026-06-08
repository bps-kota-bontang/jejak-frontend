# ================================
# Stage 1 — Build SPA
# ================================
FROM oven/bun:1.3-alpine AS build

WORKDIR /app

# Copy dependency files first (caching layer)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Optional: pass build hash or commit info
ARG BUILD_HASH
ENV VITE_BUILD_HASH=${BUILD_HASH}
ENV NODE_ENV=production

# Build the app
RUN bun run build-only --mode production


# ================================
# Stage 2 — Serve with Nginx
# ================================
FROM nginx:stable-alpine-slim AS production

# Copy compiled SPA
COPY --from=build /app/dist /usr/share/nginx/html

# Copy Nginx config
COPY default.conf /etc/nginx/conf.d/default.conf

# Make sure folders Nginx needs exist
RUN mkdir -p /var/cache/nginx /var/log/nginx

# Expose HTTP port
EXPOSE 80

# Run Nginx as root (avoids permission errors)
CMD ["nginx", "-g", "daemon off;"]
