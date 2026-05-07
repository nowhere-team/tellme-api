FROM oven/bun:alpine AS base
WORKDIR /app
ARG GITHUB_TOKEN
ENV GITHUB_TOKEN=$GITHUB_TOKEN
COPY bunfig.toml package.json bun.lock ./
COPY packages/sdk/package.json ./packages/sdk/
COPY packages/sdk/src ./packages/sdk/src
RUN bun install --frozen-lockfile --production
COPY . .

FROM oven/bun:alpine AS deps
WORKDIR /app
ARG GITHUB_TOKEN
ENV GITHUB_TOKEN=$GITHUB_TOKEN
COPY bunfig.toml package.json bun.lock ./
COPY packages/sdk/package.json ./packages/sdk/
COPY packages/sdk/src ./packages/sdk/src
RUN bun install --frozen-lockfile

FROM oven/bun:alpine AS migrator
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY bunfig.toml package.json bun.lock ./
COPY drizzle.config.ts ./
COPY src/platform/database ./src/platform/database
COPY migrations ./migrations
CMD ["bun", "run", "db:migrate"]

FROM base AS server
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
CMD ["bun", "run", "src/index.ts"]

FROM base AS worker
ENV NODE_ENV=production
CMD ["bun", "run", "src/worker.ts"]