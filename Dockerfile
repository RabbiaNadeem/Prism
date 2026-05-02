# syntax=docker/dockerfile:1

ARG NODE_VERSION=20

# Install production dependencies only; layer caches until package files change.
FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Minimal runtime image: app code + prod node_modules only.
ARG NODE_VERSION=20
FROM node:${NODE_VERSION}-alpine AS production
WORKDIR /app

ENV NODE_ENV=production

LABEL org.opencontainers.image.title="Prism" \
      org.opencontainers.image.description="OpenAI-compatible AI API gateway"

COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]
