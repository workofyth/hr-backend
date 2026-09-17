# syntax=docker/dockerfile:1

# ==============================================================================
# Stage 1: deps-prod — install HANYA dependency production (dipakai di image
# akhir). Butuh python3/make/g++ karena bcrypt adalah native module yang
# di-compile saat install.
# ==============================================================================
FROM node:20-alpine AS deps-prod
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ==============================================================================
# Stage 2: builder — install SEMUA dependency (termasuk devDependencies) lalu
# compile TypeScript -> JavaScript (dist/).
# ==============================================================================
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build

# ==============================================================================
# Stage 3: production — image akhir, ramping (tanpa build tools/devDeps).
# ==============================================================================
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY --from=deps-prod /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY public ./public
COPY docker/entrypoint.sh ./entrypoint.sh
# Dokumen karyawan (§5.2) disimpan di disk lokal, dimount sebagai volume
# Docker `employee_documents` (docker-compose.yml) — dibuat & di-chown ke
# node di sini supaya proses non-root (USER node di bawah) bisa menulis.
RUN mkdir -p ./uploads/employee-documents \
  && chmod +x ./entrypoint.sh \
  && chown -R node:node /app

USER node

EXPOSE 3000

ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", "dist/main.js"]
