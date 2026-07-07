FROM node:24-alpine3.23 AS base

#
## step 1: Prune monorepo
#
# FROM base AS builder
# RUN apk add --no-cache libc6-compat
# RUN apk update
# Set working directory
# WORKDIR /app
# RUN yarn global add turbo
# COPY . .
# RUN turbo prune @formbricks/web --docker

#
## step 2: Install & build
#
FROM base AS installer

# Enable corepack and prepare pnpm
RUN npm install --ignore-scripts -g corepack@0.35.0
RUN corepack enable
RUN corepack prepare pnpm@11.7.0 --activate

# Install necessary build tools and compilers
RUN apk update && apk add --no-cache cmake g++ gcc jq make openssl-dev python3

# Copy the secrets handling script
COPY apps/web/scripts/docker/read-secrets.sh /tmp/read-secrets.sh
RUN chmod +x /tmp/read-secrets.sh

# Increase Node.js memory limit as a regular build argument
ARG NODE_OPTIONS="--max_old_space_size=8192"
ENV NODE_OPTIONS=${NODE_OPTIONS}

# Target architecture - automatically provided by Docker in multi-platform builds
# but needs explicit declaration for some build systems (like Depot)
ARG TARGETARCH

# Base path for the application (optional)
ARG BASE_PATH=""
ENV BASE_PATH=${BASE_PATH}

# Set the working directory
WORKDIR /app

# Copy the package information
# COPY .gitignore .gitignore
# COPY --from=builder /app/out/json/ .
# COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

# Prepare the build
COPY . .

# Create a .env file
RUN touch apps/web/.env

# Install the dependencies
RUN pnpm install --ignore-scripts --frozen-lockfile

# Build the database package first. `pnpm generate` loads prisma.config.ts, which
# resolves DATABASE_URL via Prisma's env() helper and throws when it is unset. Mount
# the secret and run through the secret reader so a build-time fallback is supplied
# (mirrors the web build below); prisma generate never connects to the database.
RUN --mount=type=secret,id=database_url \
    /tmp/read-secrets.sh pnpm build --filter=@formbricks/database

# Build the project using our secret reader script
# This mounts the secrets only during this build step without storing them in layers
RUN --mount=type=secret,id=database_url \
    --mount=type=secret,id=encryption_key \
    --mount=type=secret,id=redis_url \
    --mount=type=secret,id=hub_api_url \
    --mount=type=secret,id=hub_api_key \
    --mount=type=secret,id=cubejs_api_url \
    --mount=type=secret,id=cubejs_api_secret \
    --mount=type=secret,id=sentry_auth_token \
    --mount=type=secret,id=posthog_key \
    /tmp/read-secrets.sh pnpm build --filter=@formbricks/web...

#
## step 3: setup production runner
#
FROM base AS runner

# Upgrade Alpine system packages to pick up security patches, update npm to the patched 11.x line, then create user
# Note: npm is updated in the runtime image so any bundled transitive packages scanned from the base image are patched
RUN apk update && apk upgrade --no-cache \
    && npm install --ignore-scripts -g npm@11.17.0 \
    && addgroup -S nextjs \
    && adduser -S -u 1001 -G nextjs nextjs

WORKDIR /home/nextjs

# Ensure no write permissions are assigned to the copied resources
COPY --from=installer /app/apps/web/.next/standalone ./
RUN chown -R nextjs:nextjs ./ && chmod -R 755 ./

COPY --from=installer /app/apps/web/next.config.mjs .
RUN chmod 644 ./next.config.mjs

COPY --from=installer /app/apps/web/package.json .
RUN chmod 644 ./package.json

COPY --from=installer /app/prisma.config.mjs ./prisma.config.mjs
RUN chmod 644 ./prisma.config.mjs

COPY --from=installer /app/apps/web/.next/static ./apps/web/.next/static
RUN chown -R nextjs:nextjs ./apps/web/.next/static && chmod -R 755 ./apps/web/.next/static

COPY --from=installer /app/apps/web/public ./apps/web/public
RUN chown -R nextjs:nextjs ./apps/web/public && chmod -R 755 ./apps/web/public

# Create packages/database directory structure with proper ownership for runtime migrations
RUN mkdir -p ./packages/database/migrations && chown -R nextjs:nextjs ./packages/database

COPY --from=installer /app/packages/database/package.json ./packages/database/package.json
RUN chown nextjs:nextjs ./packages/database/package.json && chmod 644 ./packages/database/package.json

COPY --from=installer /app/packages/database/schema ./packages/database/schema
RUN chown -R nextjs:nextjs ./packages/database/schema && chmod -R 755 ./packages/database/schema

# The migration runner invokes `prisma migrate deploy --config packages/database/prisma.config.ts`
COPY --from=installer /app/packages/database/prisma.config.ts ./packages/database/prisma.config.ts
RUN chown nextjs:nextjs ./packages/database/prisma.config.ts && chmod 644 ./packages/database/prisma.config.ts

COPY --from=installer /app/packages/database/dist ./packages/database/dist
RUN chown -R nextjs:nextjs ./packages/database/dist && chmod -R 755 ./packages/database/dist

# Copy Prisma v7 generated client output and runtime packages used by the
# generated client, Prisma CLI config loader, and PostgreSQL driver adapter.
COPY --from=installer /app/packages/database/generated ./packages/database/generated
RUN chown -R nextjs:nextjs ./packages/database/generated && chmod -R 755 ./packages/database/generated

COPY --from=installer /app/node_modules/@prisma ./node_modules/@prisma
RUN chown -R nextjs:nextjs ./node_modules/@prisma && chmod -R 755 ./node_modules/@prisma

COPY --from=installer /app/node_modules/prisma ./node_modules/prisma
RUN mkdir -p ./node_modules/.bin \
    && ln -sf ../prisma/build/index.js ./node_modules/.bin/prisma \
    && chown -R nextjs:nextjs ./node_modules/prisma ./node_modules/.bin \
    && chmod -R 755 ./node_modules/prisma

COPY --from=installer /app/node_modules/dotenv ./node_modules/dotenv
RUN chmod -R 755 ./node_modules/dotenv

# @prisma/config + its transitive chain. Required at runtime because the
# Prisma CLI hard-requires `@prisma/config` at module load (every invocation
# of `prisma migrate deploy`, including the one at container boot). Removing
# any of these triggers MODULE_NOT_FOUND from inside @prisma/config or its
# deps. Do NOT trim this list without first relocating migrations out of the
# runtime image (e.g. via a dedicated K8s migration job + SKIP_STARTUP_MIGRATION=true).
COPY --from=installer /app/node_modules/@standard-schema ./node_modules/@standard-schema
COPY --from=installer /app/node_modules/c12 ./node_modules/c12
COPY --from=installer /app/node_modules/confbox ./node_modules/confbox
COPY --from=installer /app/node_modules/deepmerge-ts ./node_modules/deepmerge-ts
COPY --from=installer /app/node_modules/defu ./node_modules/defu
COPY --from=installer /app/node_modules/destr ./node_modules/destr
COPY --from=installer /app/node_modules/effect ./node_modules/effect
COPY --from=installer /app/node_modules/empathic ./node_modules/empathic
COPY --from=installer /app/node_modules/exsolve ./node_modules/exsolve
COPY --from=installer /app/node_modules/fast-check ./node_modules/fast-check
COPY --from=installer /app/node_modules/giget ./node_modules/giget
COPY --from=installer /app/node_modules/jiti ./node_modules/jiti
COPY --from=installer /app/node_modules/ohash ./node_modules/ohash
COPY --from=installer /app/node_modules/pathe ./node_modules/pathe
COPY --from=installer /app/node_modules/perfect-debounce ./node_modules/perfect-debounce
COPY --from=installer /app/node_modules/pkg-types ./node_modules/pkg-types
COPY --from=installer /app/node_modules/pure-rand ./node_modules/pure-rand
COPY --from=installer /app/node_modules/rc9 ./node_modules/rc9
COPY --from=installer /app/node_modules/cross-spawn ./node_modules/cross-spawn
COPY --from=installer /app/node_modules/foreground-child ./node_modules/foreground-child
COPY --from=installer /app/node_modules/get-port-please ./node_modules/get-port-please
COPY --from=installer /app/node_modules/graceful-fs ./node_modules/graceful-fs
COPY --from=installer /app/node_modules/grammex ./node_modules/grammex
COPY --from=installer /app/node_modules/graphmatch ./node_modules/graphmatch
COPY --from=installer /app/node_modules/isexe ./node_modules/isexe
COPY --from=installer /app/node_modules/path-key ./node_modules/path-key
COPY --from=installer /app/node_modules/proper-lockfile ./node_modules/proper-lockfile
COPY --from=installer /app/node_modules/remeda ./node_modules/remeda
COPY --from=installer /app/node_modules/retry ./node_modules/retry
COPY --from=installer /app/node_modules/shebang-command ./node_modules/shebang-command
COPY --from=installer /app/node_modules/shebang-regex ./node_modules/shebang-regex
COPY --from=installer /app/node_modules/signal-exit ./node_modules/signal-exit
COPY --from=installer /app/node_modules/std-env ./node_modules/std-env
COPY --from=installer /app/node_modules/valibot ./node_modules/valibot
COPY --from=installer /app/node_modules/which ./node_modules/which
COPY --from=installer /app/node_modules/zeptomatch ./node_modules/zeptomatch
RUN chmod -R 755 \
  ./node_modules/@standard-schema \
  ./node_modules/c12 \
  ./node_modules/confbox \
  ./node_modules/deepmerge-ts \
  ./node_modules/defu \
  ./node_modules/destr \
  ./node_modules/effect \
  ./node_modules/empathic \
  ./node_modules/exsolve \
  ./node_modules/fast-check \
  ./node_modules/giget \
  ./node_modules/jiti \
  ./node_modules/ohash \
  ./node_modules/pathe \
  ./node_modules/perfect-debounce \
  ./node_modules/pkg-types \
  ./node_modules/pure-rand \
  ./node_modules/rc9 \
  ./node_modules/cross-spawn \
  ./node_modules/foreground-child \
  ./node_modules/get-port-please \
  ./node_modules/graceful-fs \
  ./node_modules/grammex \
  ./node_modules/graphmatch \
  ./node_modules/isexe \
  ./node_modules/path-key \
  ./node_modules/proper-lockfile \
  ./node_modules/remeda \
  ./node_modules/retry \
  ./node_modules/shebang-command \
  ./node_modules/shebang-regex \
  ./node_modules/signal-exit \
  ./node_modules/std-env \
  ./node_modules/valibot \
  ./node_modules/which \
  ./node_modules/zeptomatch

COPY --from=installer /app/node_modules/pg ./node_modules/pg
COPY --from=installer /app/node_modules/pg-connection-string ./node_modules/pg-connection-string
COPY --from=installer /app/node_modules/pg-cloudflare ./node_modules/pg-cloudflare
COPY --from=installer /app/node_modules/pg-int8 ./node_modules/pg-int8
COPY --from=installer /app/node_modules/pg-pool ./node_modules/pg-pool
COPY --from=installer /app/node_modules/pg-protocol ./node_modules/pg-protocol
COPY --from=installer /app/node_modules/pg-types ./node_modules/pg-types
COPY --from=installer /app/node_modules/pgpass ./node_modules/pgpass
COPY --from=installer /app/node_modules/postgres-array ./node_modules/postgres-array
COPY --from=installer /app/node_modules/postgres-bytea ./node_modules/postgres-bytea
COPY --from=installer /app/node_modules/postgres-date ./node_modules/postgres-date
COPY --from=installer /app/node_modules/postgres-interval ./node_modules/postgres-interval
COPY --from=installer /app/node_modules/split2 ./node_modules/split2
RUN chmod -R 755 \
  ./node_modules/pg \
  ./node_modules/pg-connection-string \
  ./node_modules/pg-cloudflare \
  ./node_modules/pg-int8 \
  ./node_modules/pg-pool \
  ./node_modules/pg-protocol \
  ./node_modules/pg-types \
  ./node_modules/pgpass \
  ./node_modules/postgres-array \
  ./node_modules/postgres-bytea \
  ./node_modules/postgres-date \
  ./node_modules/postgres-interval \
  ./node_modules/split2

COPY --from=installer /app/node_modules/@paralleldrive/cuid2 ./node_modules/@paralleldrive/cuid2
RUN chmod -R 755 ./node_modules/@paralleldrive/cuid2

# Runtime migrations import uuid v7 from the database package, so copy the
# database package's resolved install instead of the repo-root hoisted version.
COPY --from=installer /app/packages/database/node_modules/uuid ./node_modules/uuid
RUN chmod -R 755 ./node_modules/uuid \
    && node --input-type=module -e "\
      import { v7 } from 'uuid'; \
      if (typeof v7 !== 'function') { \
        throw new Error('uuid v7 missing in runtime image'); \
      }"

COPY --from=installer /app/node_modules/@noble/hashes ./node_modules/@noble/hashes
RUN chmod -R 755 ./node_modules/@noble/hashes

COPY --from=installer /app/node_modules/zod ./node_modules/zod
RUN chmod -R 755 ./node_modules/zod

# Pino loads transport code in worker threads via dynamic require().
# Next.js file tracing only traces static imports, missing runtime-loaded files
# (e.g. pino/lib/transport-stream.js, transport targets).
# Copy the full packages to ensure all runtime files are available.
COPY --from=installer /app/node_modules/pino ./node_modules/pino
RUN chmod -R 755 ./node_modules/pino

COPY --from=installer /app/node_modules/pino-opentelemetry-transport ./node_modules/pino-opentelemetry-transport
RUN chmod -R 755 ./node_modules/pino-opentelemetry-transport

COPY --from=installer /app/node_modules/pino-abstract-transport ./node_modules/pino-abstract-transport
RUN chmod -R 755 ./node_modules/pino-abstract-transport

COPY --from=installer /app/node_modules/otlp-logger ./node_modules/otlp-logger
RUN chmod -R 755 ./node_modules/otlp-logger

COPY --from=installer /app/node_modules/@opentelemetry/sdk-logs ./node_modules/@opentelemetry/sdk-logs
COPY --from=installer /app/node_modules/@opentelemetry/exporter-logs-otlp-proto ./node_modules/@opentelemetry/exporter-logs-otlp-proto
RUN chmod -R 755 \
      ./node_modules/@opentelemetry/sdk-logs \
      ./node_modules/@opentelemetry/exporter-logs-otlp-proto \
    && OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318 node -e "\
      const pino = require('pino'); \
      const target = process.cwd() + '/node_modules/pino-opentelemetry-transport/lib/pino-opentelemetry-transport.js'; \
      process.on('uncaughtException', (error) => { console.error(error); process.exit(1); }); \
      process.on('unhandledRejection', (error) => { console.error(error); process.exit(1); }); \
      const logger = pino({ \
        transport: { \
          target, \
          options: { \
            loggerName: 'formbricks-build-smoke', \
            serviceVersion: '0.0.0', \
            resourceAttributes: { \
              'service.name': 'formbricks-build-smoke', \
              'service.version': '0.0.0' \
            } \
          } \
        } \
      }); \
      logger[pino.symbols.streamSym]?.on?.('error', (error) => { console.error(error); process.exit(1); }); \
      logger.info('pino otel transport smoke check'); \
      setTimeout(() => process.exit(0), 1000); \
    "

# Create a startup script to handle the conditional logic
COPY --from=installer /app/apps/web/scripts/docker/next-start.sh /home/nextjs/start.sh
RUN chown nextjs:nextjs /home/nextjs/start.sh && chmod +x /home/nextjs/start.sh

EXPOSE 3000
ENV HOSTNAME="0.0.0.0"
USER nextjs

# Prepare volumes for uploads and SAML connections
RUN mkdir -p /home/nextjs/apps/web/uploads/ && \
    mkdir -p /home/nextjs/apps/web/saml-connection

VOLUME /home/nextjs/apps/web/uploads/
VOLUME /home/nextjs/apps/web/saml-connection

CMD ["/home/nextjs/start.sh"]
