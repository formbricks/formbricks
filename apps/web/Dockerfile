FROM node:22-alpine3.21 AS base

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
RUN npm install -g corepack@latest
RUN corepack enable

# Install necessary build tools and compilers, plus dependencies for custom builds
# Added: meson, ninja, pkg-config, libffi-dev, pcre2-dev for glib
RUN apk update && apk add --no-cache \
    cmake g++ gcc jq make openssl-dev python3 \
    build-base wget tar linux-headers zlib-dev perl \
    meson ninja pkg-config libffi-dev pcre2-dev

# --- Build custom OpenSSL ---
ARG OPENSSL_VERSION=3.3.1 # Using latest LTS as 3.5.0 is not available
RUN set -eux; \
    cd /tmp; \
    wget "https://www.openssl.org/source/openssl-${OPENSSL_VERSION}.tar.gz"; \
    tar -xzf "openssl-${OPENSSL_VERSION}.tar.gz"; \
    cd "openssl-${OPENSSL_VERSION}"; \
    ./config --prefix=/usr/local --openssldir=/usr/local/ssl shared zlib; \
    make -j$(nproc); \
    make install_sw; \
    cd /; \
    rm -rf "/tmp/openssl-${OPENSSL_VERSION}"; \
    find /usr/local/lib -name '*.a' -delete

# --- Build custom libxml2 ---
ARG LIBXML2_VERSION=2.14.1 # User requested 2.14.1
RUN set -eux; \
    cd /tmp; \
    LIBXML2_MAJOR_MINOR=$(echo $LIBXML2_VERSION | cut -d. -f1-2); \
    wget "https://download.gnome.org/sources/libxml2/${LIBXML2_MAJOR_MINOR}/libxml2-${LIBXML2_VERSION}.tar.xz"; \
    tar -xf "libxml2-${LIBXML2_VERSION}.tar.xz"; \
    cd "libxml2-${LIBXML2_VERSION}"; \
    ./configure --prefix=/usr/local --without-python --with-zlib=/usr; \
    make -j$(nproc); \
    make install; \
    cd /; \
    rm -rf "/tmp/libxml2-${LIBXML2_VERSION}"; \
    find /usr/local/lib -name '*.a' -delete

# --- Build custom c-ares ---
ARG CARES_VERSION=1.30.0 # Using latest stable as 1.3.0 is very old
RUN set -eux; \
    cd /tmp; \
    wget "https://c-ares.org/download/c-ares-${CARES_VERSION}.tar.gz"; \
    tar -xzf "c-ares-${CARES_VERSION}.tar.gz"; \
    cd "c-ares-${CARES_VERSION}"; \
    # Use CMake for c-ares
    cmake . -DCMAKE_INSTALL_PREFIX=/usr/local; \
    make -j$(nproc); \
    make install; \
    cd /; \
    rm -rf "/tmp/c-ares-${CARES_VERSION}"; \
    find /usr/local/lib -name '*.a' -delete

# --- Build custom SQLite ---
ARG SQLITE_VERSION_STR=3.46.0 # Using latest stable as 3.49.1 is not available
ARG SQLITE_VERSION_NUM=3460000
ARG SQLITE_YEAR=2024
RUN set -eux; \
    cd /tmp; \
    wget "https://www.sqlite.org/${SQLITE_YEAR}/sqlite-autoconf-${SQLITE_VERSION_NUM}.tar.gz"; \
    tar -xzf "sqlite-autoconf-${SQLITE_VERSION_NUM}.tar.gz"; \
    cd "sqlite-autoconf-${SQLITE_VERSION_NUM}"; \
    ./configure --prefix=/usr/local; \
    make -j$(nproc); \
    make install; \
    cd /; \
    rm -rf "/tmp/sqlite-autoconf-${SQLITE_VERSION_NUM}"; \
    find /usr/local/lib -name '*.a' -delete

# --- Build custom GLib ---
ARG GLIB_VERSION=2.80.2 # Using latest stable as 2.84.1 is not available
RUN set -eux; \
    cd /tmp; \
    GLIB_MAJOR_MINOR=$(echo $GLIB_VERSION | cut -d. -f1-2); \
    wget "https://download.gnome.org/sources/glib/${GLIB_MAJOR_MINOR}/glib-${GLIB_VERSION}.tar.xz"; \
    tar -xf "glib-${GLIB_VERSION}.tar.xz"; \
    cd "glib-${GLIB_VERSION}"; \
    # Use Meson for GLib, disable features not needed/problematic in Alpine
    meson setup _build --prefix=/usr/local -Ddocumentation=false -Dtests=false -Dlibmount=disabled -Dselinux=disabled -Dxattr=false; \
    ninja -C _build; \
    ninja -C _build install; \
    cd /; \
    rm -rf "/tmp/glib-${GLIB_VERSION}"; \
    find /usr/local/lib -name '*.a' -delete

# Configure linker path for build time tools that might need the custom libs
ENV LD_LIBRARY_PATH=/usr/local/lib:$LD_LIBRARY_PATH

# BuildKit secret handling without hardcoded fallback values
# This approach relies entirely on secrets passed from GitHub Actions
RUN echo '#!/bin/sh' > /tmp/read-secrets.sh && \
    echo 'if [ -f "/run/secrets/database_url" ]; then' >> /tmp/read-secrets.sh && \
    echo '  export DATABASE_URL=$(cat /run/secrets/database_url)' >> /tmp/read-secrets.sh && \
    echo 'else' >> /tmp/read-secrets.sh && \
    echo '  echo "DATABASE_URL secret not found. Build may fail if this is required."' >> /tmp/read-secrets.sh && \
    echo 'fi' >> /tmp/read-secrets.sh && \
    echo 'if [ -f "/run/secrets/encryption_key" ]; then' >> /tmp/read-secrets.sh && \
    echo '  export ENCRYPTION_KEY=$(cat /run/secrets/encryption_key)' >> /tmp/read-secrets.sh && \
    echo 'else' >> /tmp/read-secrets.sh && \
    echo '  echo "ENCRYPTION_KEY secret not found. Build may fail if this is required."' >> /tmp/read-secrets.sh && \
    echo 'fi' >> /tmp/read-secrets.sh && \
    echo 'exec "$@"' >> /tmp/read-secrets.sh && \
    chmod +x /tmp/read-secrets.sh

# Increase Node.js memory limit as a regular build argument
ARG NODE_OPTIONS="--max_old_space_size=4096"
ENV NODE_OPTIONS=${NODE_OPTIONS}

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
RUN pnpm install

# Build the project using our secret reader script
# This mounts the secrets only during this build step without storing them in layers
RUN --mount=type=secret,id=database_url \
    --mount=type=secret,id=encryption_key \
    /tmp/read-secrets.sh pnpm build --filter=@formbricks/web...

# Extract Prisma version
RUN jq -r '.devDependencies.prisma' packages/database/package.json > /prisma_version.txt

#
## step 3: setup production runner
#
FROM base AS runner

RUN npm install -g corepack@latest
RUN corepack enable

# Install runtime dependencies for custom builds (e.g., zlib for libxml2/openssl) and existing ones
# Added: libffi, pcre2 for glib runtime
RUN apk add --no-cache curl supercronic zlib libffi pcre2

RUN addgroup -S nextjs && adduser -S -u 1001 -G nextjs nextjs

WORKDIR /home/nextjs

# Copy compiled libraries from installer stage to /usr/local/lib
COPY --from=installer /usr/local/lib/libssl.so.* /usr/local/lib/
COPY --from=installer /usr/local/lib/libcrypto.so.* /usr/local/lib/
COPY --from=installer /usr/local/lib/libxml2.so.* /usr/local/lib/
COPY --from=installer /usr/local/lib/libcares.so.* /usr/local/lib/
COPY --from=installer /usr/local/lib/libsqlite3.so.* /usr/local/lib/
# GLib has multiple libraries, copy them all
COPY --from=installer /usr/local/lib/libglib-2.0.so.* /usr/local/lib/
COPY --from=installer /usr/local/lib/libgobject-2.0.so.* /usr/local/lib/
COPY --from=installer /usr/local/lib/libgmodule-2.0.so.* /usr/local/lib/
COPY --from=installer /usr/local/lib/libgio-2.0.so.* /usr/local/lib/

# Configure linker path for runtime
ENV LD_LIBRARY_PATH=/usr/local/lib:$LD_LIBRARY_PATH

# Ensure no write permissions are assigned to the copied resources
COPY --from=installer /app/apps/web/.next/standalone ./
RUN chown -R nextjs:nextjs ./ && chmod -R 755 ./

COPY --from=installer /app/apps/web/next.config.mjs .
RUN chmod 644 ./next.config.mjs

COPY --from=installer /app/apps/web/package.json .
RUN chmod 644 ./package.json

COPY --from=installer /app/apps/web/.next/static ./apps/web/.next/static
RUN chown -R nextjs:nextjs ./apps/web/.next/static && chmod -R 755 ./apps/web/.next/static

COPY --from=installer /app/apps/web/public ./apps/web/public
RUN chown -R nextjs:nextjs ./apps/web/public && chmod -R 755 ./apps/web/public

COPY --from=installer /app/packages/database/schema.prisma ./packages/database/schema.prisma
RUN chown nextjs:nextjs ./packages/database/schema.prisma && chmod 644 ./packages/database/schema.prisma

COPY --from=installer /app/packages/database/package.json ./packages/database/package.json
RUN chown nextjs:nextjs ./packages/database/package.json && chmod 644 ./packages/database/package.json

COPY --from=installer /app/packages/database/migration ./packages/database/migration
RUN chown -R nextjs:nextjs ./packages/database/migration && chmod -R 755 ./packages/database/migration

COPY --from=installer /app/packages/database/src ./packages/database/src
RUN chown -R nextjs:nextjs ./packages/database/src && chmod -R 755 ./packages/database/src

COPY --from=installer /app/packages/database/node_modules ./packages/database/node_modules
RUN chown -R nextjs:nextjs ./packages/database/node_modules && chmod -R 755 ./packages/database/node_modules

COPY --from=installer /app/packages/logger/dist ./packages/database/node_modules/@formbricks/logger/dist
RUN chown -R nextjs:nextjs ./packages/database/node_modules/@formbricks/logger/dist && chmod -R 755 ./packages/database/node_modules/@formbricks/logger/dist

COPY --from=installer /app/node_modules/@prisma/client ./node_modules/@prisma/client
RUN chown -R nextjs:nextjs ./node_modules/@prisma/client && chmod -R 755 ./node_modules/@prisma/client

COPY --from=installer /app/node_modules/.prisma ./node_modules/.prisma
RUN chown -R nextjs:nextjs ./node_modules/.prisma && chmod -R 755 ./node_modules/.prisma

COPY --from=installer /prisma_version.txt .
RUN chown nextjs:nextjs ./prisma_version.txt && chmod 644 ./prisma_version.txt

COPY /docker/cronjobs /app/docker/cronjobs
RUN chmod -R 755 /app/docker/cronjobs

COPY --from=installer /app/node_modules/@paralleldrive/cuid2 ./node_modules/@paralleldrive/cuid2
RUN chmod -R 755 ./node_modules/@paralleldrive/cuid2

COPY --from=installer /app/node_modules/@noble/hashes ./node_modules/@noble/hashes
RUN chmod -R 755 ./node_modules/@noble/hashes

COPY --from=installer /app/node_modules/zod ./node_modules/zod
RUN chmod -R 755 ./node_modules/zod

# Set permissions for copied custom libraries (readable/executable by all)
RUN chmod -R 555 /usr/local/lib/*so*

RUN npm install -g tsx typescript prisma pino-pretty

EXPOSE 3000
ENV HOSTNAME "0.0.0.0"
ENV NODE_ENV="production"

# Prepare volume for uploads
RUN mkdir -p /home/nextjs/apps/web/uploads/
VOLUME /home/nextjs/apps/web/uploads/

# Prepare volume for SAML preloaded connection
RUN mkdir -p /home/nextjs/apps/web/saml-connection
VOLUME /home/nextjs/apps/web/saml-connection

USER nextjs

CMD if [ "${DOCKER_CRON_ENABLED:-1}" = "1" ]; then \
      echo "Starting cron jobs..."; \
      supercronic -quiet /app/docker/cronjobs & \
    else \
      echo "Docker cron jobs are disabled via DOCKER_CRON_ENABLED=0"; \
    fi; \
    (cd packages/database && npm run db:migrate:deploy) && \
    (cd packages/database && npm run db:create-saml-database:deploy) && \
    exec node apps/web/server.js