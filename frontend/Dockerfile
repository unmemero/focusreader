# syntax=docker/dockerfile:1

# -----------------------------------------------------------------------------
# Stage 1: Build the Vite React Frontend
# -----------------------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json ./

# Clean install dependencies
RUN npm ci

# Copy source code and build config
COPY . ./

# Compile production bundle
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2: Serve with High-Performance Nginx
# -----------------------------------------------------------------------------
FROM nginx:alpine AS runner

# Remove default nginx website
RUN rm -rf /usr/share/nginx/html/*

# Copy built static assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy optimized nginx reverse proxy configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --spider -q http://127.0.0.1:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
