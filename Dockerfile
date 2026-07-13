# syntax=docker/dockerfile:1.7

FROM node:24-alpine AS build

ARG PNPM_VERSION=11.12.0
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV ASTRO_TELEMETRY_DISABLED=1

RUN npm install --global "pnpm@${PNPM_VERSION}"

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm check && pnpm build

FROM ghcr.io/static-web-server/static-web-server:2.43.0-alpine AS runtime

COPY --chown=sws:sws sws.toml /home/sws/sws.toml
COPY --chown=sws:sws --from=build /app/dist/ /home/sws/public/

ENV SERVER_CONFIG_FILE=/home/sws/sws.toml

USER sws
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --spider http://127.0.0.1:8080/health || exit 1
