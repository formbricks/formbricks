# syntax=docker/dockerfile:1.20
# The syntax line must stay first: `COPY --parents` below needs Dockerfile frontend 1.20.

# Node is the official release binary from nodejs.org, taken from the Docker Official Image and pinned by
# digest; Dependabot moves the digests (.github/dependabot.yml). The tag must hold the exact .nvmrc version,
# which node-version-alignment.test.ts enforces. glibc is a Tier 1 Node platform; Alpine's musl is not.
#
# The binary embeds OpenSSL and Mozilla's root CA list, so TLS and CA fixes arrive as Node security
# releases (a new .nvmrc version), not as OS package upgrades. Node trusts its bundled list, not the OS
# store; that list also blocks the compromised eMudhra intermediates (ENG-4065), and NODE_EXTRA_CA_CERTS
# adds private CAs on top.
FROM node:26.13.1-trixie-slim@sha256:e6bedef217677b276c591795e169840edd9096dbf13f29df8ef8d1856b8820bc AS base

# The runtime gets only the node binary: no npm, npx, corepack or yarn. libatomic1 is the one library the
# binary links that Debian's slim image lacks. Prisma's schema engine, which runs the migrations, is a
# native binary that links OpenSSL (libssl3t64) and verifies database TLS against the OS CA bundle
# (ca-certificates); Node itself reads neither. apt-get upgrade picks up Debian security fixes released
# after the pinned digest.
#
# Debian's bundle still ships emSign roots that Mozilla and Node have dropped or distrust (ENG-4065), so
# they are deselected here; verify-runtime.mjs fails the build if one comes back.
FROM debian:trixie-slim@sha256:a72b4433de1cf7d6bae0c4cee74d0547f58601a643b3375f070c51600d63b6b2 AS runtime-base
RUN apt-get update \
    && apt-get upgrade -y --no-install-recommends \
    && apt-get install -y --no-install-recommends ca-certificates libatomic1 libssl3t64 \
    && rm -rf /var/lib/apt/lists/* \
    && sed -i -E 's#^(mozilla/emSign_.*\.crt)$#!\1#' /etc/ca-certificates.conf \
    && update-ca-certificates --fresh > /dev/null
COPY --from=base /usr/local/bin/node /usr/local/bin/node
# The official image drops Node's license file, which redistributing the binary requires.
ADD --checksum=sha256:8e603aa87c70d36e497004f0dec63111511cb61b7d65ace12e10ea791599286c \
    https://raw.githubusercontent.com/nodejs/node/v26.13.1/LICENSE /usr/local/share/doc/node/LICENSE
RUN chmod 644 /usr/local/share/doc/node/LICENSE
COPY apps/web/scripts/docker/verify-runtime.mjs /tmp/verify-runtime.mjs
RUN node /tmp/verify-runtime.mjs && rm /tmp/verify-runtime.mjs

#
## step 1: Install & build
#
FROM base AS installer

# Enable corepack and prepare pnpm
RUN npm install --ignore-scripts -g corepack@0.35.0
RUN corepack enable
RUN corepack prepare pnpm@11.7.0 --activate

# Increase Node.js memory limit as a regular build argument
ARG NODE_OPTIONS="--max_old_space_size=8192"
ENV NODE_OPTIONS=${NODE_OPTIONS}

# pnpm 11 checks node_modules against the manifests before every `pnpm run` and, by default,
# silently re-installs on drift — without --ignore-scripts or the store mount below. Fail instead.
ENV pnpm_config_verify_deps_before_run=error

# Set the working directory
WORKDIR /app

# Copy only what the install reads, so a source-only change reuses the install layer. Everything
# that busts this layer (the secrets script, BASE_PATH) is declared after it. xlsx is a `file:`
# dependency on a tarball under apps/web/vendor, so the install needs that directory too. Keep these
# COPYs in sync with the timestamp reset after `COPY . .` below.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY patches ./patches
COPY --parents apps/*/package.json packages/*/package.json docker/package.json ./
COPY apps/web/vendor ./apps/web/vendor

# Install the dependencies. The store and metadata cache live in cache mounts rather than the layer:
# a persistent builder (Depot) re-links from a warm store when a manifest changes, and a cold one
# just downloads as before. No --offline: the release-age re-check (trustLockfile: false in
# pnpm-workspace.yaml) needs registry metadata whenever the cache mount is empty.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    --mount=type=cache,id=pnpm-cache,target=/root/.cache/pnpm \
    pnpm install --ignore-scripts --frozen-lockfile --prefer-offline --store-dir=/pnpm/store

# Copy the secrets handling script
COPY apps/web/scripts/docker/read-secrets.sh /tmp/read-secrets.sh
RUN chmod +x /tmp/read-secrets.sh

# Target architecture - automatically provided by Docker in multi-platform builds
# but needs explicit declaration for some build systems (like Depot)
ARG TARGETARCH

# Base path for the application (optional)
ARG BASE_PATH=""
ENV BASE_PATH=${BASE_PATH}

# Prepare the build
COPY . .

# Before each `pnpm run`, pnpm 11 re-checks every install input whose mtime is newer than the install's
# last validation: a newer patch fails as "Patches were modified", a newer manifest gets a deep check
# against the lockfile that rejects apps/web's `file:` tarball dependency. A reused install layer
# (Depot's persistent cache) is always older than this checkout, so COPY . . above makes every install
# input look newer. Their content is exactly what the install read (the COPYs before it are its cache
# key), so set their timestamps back to before the install, as a fresh install would leave them. The
# list mirrors those COPYs. Not `COPY --exclude`: BuildKit then follows the apps/web/.env symlink to the
# root .env, which stays out of the context.
RUN touch -c -t 200001010000 pnpm-lock.yaml pnpm-workspace.yaml package.json docker/package.json \
      apps/*/package.json packages/*/package.json \
    && find patches apps/web/vendor -type f -exec touch -t 200001010000 {} +

# Create a .env file
RUN touch apps/web/.env

# Build the database package first. `pnpm generate` loads prisma.config.ts, which
# resolves DATABASE_URL via Prisma's env() helper and throws when it is unset. Mount
# the secret and run through the secret reader so a build-time fallback is supplied
# (mirrors the web build below); prisma generate never connects to the database.
RUN --mount=type=secret,id=database_url \
    /tmp/read-secrets.sh pnpm build --filter=@formbricks/database

# Public inputs participate in Docker cache keys; credentials remain secret mounts.
ARG FORMBRICKS_DEPLOYMENT_ID=""
ARG FORMBRICKS_BUILD_VARIANT="local"

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
    /tmp/read-secrets.sh node apps/web/scripts/docker/build-next-runtime.mjs

#
## step 2: setup production runner
#
FROM runtime-base AS runner

# The application and migrations invoke Node directly; the runtime contains no npm/npx or build headers.
# UID 1001 and GID 101 match the earlier Alpine image, so existing upload volumes keep their ownership.
# The home directory starts empty and owned by nextjs, as Alpine's adduser left it (no /etc/skel files).
RUN groupadd --system --gid 101 nextjs \
    && useradd --uid 1001 --gid nextjs --home-dir /home/nextjs --no-create-home \
      --shell /usr/sbin/nologin nextjs \
    && install -d -o nextjs -g nextjs -m 755 /home/nextjs

WORKDIR /home/nextjs

# Ensure no write permissions are assigned to the copied resources
ARG FORMBRICKS_DEPLOYMENT_ID=""
ARG FORMBRICKS_BUILD_VARIANT="local"
LABEL com.formbricks.build.identity=$FORMBRICKS_DEPLOYMENT_ID
LABEL com.formbricks.build.variant=$FORMBRICKS_BUILD_VARIANT
COPY --from=installer /app/next-runtime ./
RUN node verify-next-runtime.mjs "$FORMBRICKS_DEPLOYMENT_ID" "$FORMBRICKS_BUILD_VARIANT" \
    && chown -R nextjs:nextjs ./ && chmod -R 755 ./

COPY --from=installer /app/apps/web/next.config.mjs .
RUN chmod 644 ./next.config.mjs

COPY --from=installer /app/apps/web/package.json .
RUN chmod 644 ./package.json

COPY --from=installer /app/apps/web/dist/docker/validate-env.mjs ./validate-env.mjs
RUN chown nextjs:nextjs ./validate-env.mjs && chmod 444 ./validate-env.mjs

COPY --from=installer /app/apps/web/dist/authzed-cli ./authzed-cli
RUN chown -R nextjs:nextjs ./authzed-cli \
    && find ./authzed-cli -type d -exec chmod 555 {} + \
    && find ./authzed-cli -type f -exec chmod 444 {} +

COPY --from=installer /app/apps/web/scripts/docker/formbricks-authzed /usr/local/bin/formbricks-authzed
RUN chown root:root /usr/local/bin/formbricks-authzed && chmod 555 /usr/local/bin/formbricks-authzed

COPY --from=installer /app/apps/web/scripts/docker/formbricks-authzed-prepare /usr/local/bin/formbricks-authzed-prepare
RUN chown root:root /usr/local/bin/formbricks-authzed-prepare && chmod 555 /usr/local/bin/formbricks-authzed-prepare

COPY --from=installer /app/prisma.config.mjs ./prisma.config.mjs
RUN chmod 644 ./prisma.config.mjs

# Create packages/database directory structure with proper ownership for runtime migrations
RUN mkdir -p ./packages/database/.prisma-migrations && chown -R nextjs:nextjs ./packages/database

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

COPY apps/web/scripts/docker/verify-runtime.mjs ./verify-runtime.mjs
RUN node ./verify-runtime.mjs --dependencies && rm ./verify-runtime.mjs

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
      process.chdir('/home/nextjs/apps/web'); \
      const runtimeRoot = process.cwd().replace(/[\/\\\\]apps[\/\\\\]web$/, ''); \
      const target = runtimeRoot + '/node_modules/pino-opentelemetry-transport/lib/pino-opentelemetry-transport.js'; \
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
# Check the finished filesystem as the runtime user, after all dependency overlays.
RUN mkdir -p /home/nextjs/apps/web/uploads/ && \
    mkdir -p /home/nextjs/apps/web/saml-connection && \
    node verify-next-runtime.mjs "$FORMBRICKS_DEPLOYMENT_ID" "$FORMBRICKS_BUILD_VARIANT"

VOLUME /home/nextjs/apps/web/uploads/
VOLUME /home/nextjs/apps/web/saml-connection

CMD ["/home/nextjs/start.sh"]
