# webadmin · vite build → nginx alpine serve
# build context = `webadmin`

# ═══════════════════════════ Stage 1: build ═══════════════════════════
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund
COPY . .
RUN npm run build

# ═══════════════════════════ Stage 2: nginx serve ═══════════════════════════
FROM nginx:1.27-alpine AS runtime
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O - http://localhost/health.txt > /dev/null || exit 1
