# Build environment for Anthropic's OSS Scanner (https://red.anthropic.com/oss-scanner/).
#
# The scanner builds this image with network access, then runs its audit offline, so every
# dependency, generated client and build artifact an agent needs must be produced here.
# Toolchain mirrors apps/web/Dockerfile: Node 26 (see .nvmrc) and pnpm 11.7.0 (packageManager).

FROM node:26-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive \
    NEXT_TELEMETRY_DISABLED=1 \
    HUSKY=0 \
    NODE_OPTIONS=--max-old-space-size=4096

# Native-module and Prisma toolchain. Install scripts in the lockfile download prebuilt
# binaries (sharp, esbuild, Prisma engines) and compile the packages that have no prebuild.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates git jq make g++ gcc python3 cmake pkg-config libssl-dev openssl \
    && rm -rf /var/lib/apt/lists/*

RUN npm install --global --ignore-scripts pnpm@11.7.0

# Scanner contract: the checkout lives at /src.
COPY . /src
WORKDIR /src

# Build-time placeholders only. `prisma generate` and `next build` validate that these are
# present; nothing in the image connects to the services they point at (the audit is offline).
ENV DATABASE_URL=postgresql://test:test@localhost:5432/formbricks \
    ENCRYPTION_KEY=0123456789abcdef0123456789abcdef \
    NEXTAUTH_SECRET=build-time-placeholder \
    CRON_SECRET=build-time-placeholder \
    REDIS_URL=redis://localhost:6379 \
    HUB_API_URL=http://localhost:4000 \
    HUB_API_KEY=build-time-placeholder \
    CUBEJS_API_URL=http://localhost:4000 \
    CUBEJS_API_SECRET=build-time-placeholder \
    WEBAPP_URL=http://localhost:3000 \
    NEXTAUTH_URL=http://localhost:3000

# dotenv-cli (`pnpm test`, `pnpm typegen`) expects these files to exist.
RUN touch .env apps/web/.env

RUN pnpm install --frozen-lockfile

# Build every library workspace the way CI does, including @formbricks/database#generate
# (Prisma client) and the bundles the web app serves. Two tasks at a time keeps memory bounded.
#
# The web app's production `next build` is deliberately not run here: it asks V8 for an 8192 MB
# heap (apps/web/package.json) and Turbopack needs more than an 8 GB machine, while the audit
# reads and tests the TypeScript sources directly. Run it yourself if a finding needs it:
#   pnpm --filter @formbricks/web build
RUN pnpm build --filter='!@formbricks/web' --concurrency=2

# Sanity-check the image with the cheap unit suites. Failures are warnings, per the scanner
# contract: the build must not abort on a test failure.
RUN pnpm --filter @formbricks/workflows test || echo "WARNING: @formbricks/workflows tests failed"
RUN pnpm --filter @formbricks/surveys test || echo "WARNING: @formbricks/surveys tests failed"
# The web app is the larger half of the codebase; one representative suite proves its vitest
# setup works without network access.
RUN pnpm --filter @formbricks/web exec vitest run lib/membership/utils.test.ts \
    || echo "WARNING: @formbricks/web unit tests failed"
