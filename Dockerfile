# syntax=docker/dockerfile:1.7

FROM node:26-alpine AS build

ARG PNPM_VERSION=12.4.2
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV ASTRO_TELEMETRY_DISABLED=1

RUN npm install --global "pnpm@${PNPM_VERSION}"

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm check && pnpm build

FROM node:26-alpine AS runtime

WORKDIR /app
COPY --chown=node:node --from=build /app/dist/ ./dist/
COPY --chown=node:node server/ ./server/
COPY --chown=node:node scripts/guestbook.mjs ./scripts/guestbook.mjs
RUN mkdir /data && chown node:node /data
ENV NODE_ENV=production DATA_DIR=/data PORT=8080
USER node
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --spider http://127.0.0.1:8080/health || exit 1

CMD ["node", "server/index.mjs"]
