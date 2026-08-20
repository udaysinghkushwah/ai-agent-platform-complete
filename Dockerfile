# Multi-stage production Dockerfile for AI Agent Platform
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-complaint openssl python3 make g++

# 1. Install dependencies
FROM base AS dependencies
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/worker/package.json ./apps/worker/package.json
COPY apps/dashboard/package.json ./apps/dashboard/package.json
COPY apps/demo-agent/package.json ./apps/demo-agent/package.json
COPY packages/sdk-node/package.json ./packages/sdk-node/package.json
COPY packages/cli/package.json ./packages/cli/package.json
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN npm ci

# 2. Build code
FROM dependencies AS builder
COPY . .
RUN npx prisma generate
RUN npm run build --workspaces

# 3. Production API Service
FROM base AS api
WORKDIR /app
COPY --from=builder /app ./
EXPOSE 3000
CMD ["npm", "--workspace=@aap/api", "run", "start:prod"]

# 4. Production Async Worker Service
FROM base AS worker
WORKDIR /app
COPY --from=builder /app ./
CMD ["npm", "--workspace=@aap/worker", "run", "start:prod"]

# 5. Production Dashboard Web Application
FROM base AS dashboard
WORKDIR /app
COPY --from=builder /app ./
EXPOSE 3001
CMD ["npm", "--workspace=@aap/dashboard", "run", "start"]

# 6. Demo Integration Agent
FROM base AS demo-agent
WORKDIR /app
COPY --from=builder /app ./
EXPOSE 4000
CMD ["npm", "--workspace=@aap/demo-agent", "run", "start"]
