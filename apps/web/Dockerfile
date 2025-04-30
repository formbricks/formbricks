FROM node:22-alpine3.21 AS base

# Get packages from Edge repository
FROM alpine:edge AS edge-packages

# Install packages from edge that are available
RUN apk update && \
    # Install the edge packages we need
    apk add --no-cache \
        openssl=3.5.0-r0 \
        sqlite=3.49.1-r1 \
        glib=2.84.1-r0 && \
    # Create directory for package files
    mkdir -p /edge-packages/lib /edge-packages/bin /edge-packages/etc && \
    # Copy libraries with error handling
    cp -a /usr/lib/libssl.so* /edge-packages/lib/ 2>/dev/null || true && \
    cp -a /usr/lib/libcrypto.so* /edge-packages/lib/ 2>/dev/null || true && \
    cp -a /usr/bin/openssl /edge-packages/bin/ 2>/dev/null || true && \
    cp -a /etc/ssl /edge-packages/etc/ 2>/dev/null || true && \
    # Find SQLite libraries
    find /usr -name "libsqlite*.so*" -exec cp -a {} /edge-packages/lib/ \; 2>/dev/null || true && \
    # Copy GLib files
    cp -a /usr/lib/libglib-2.0.so* /edge-packages/lib/ 2>/dev/null || true && \
    cp -a /usr/lib/libgmodule-2.0.so* /edge-packages/lib/ 2>/dev/null || true && \
    cp -a /usr/lib/libgobject-2.0.so* /edge-packages/lib/ 2>/dev/null || true && \
    cp -a /usr/lib/libgio-2.0.so* /edge-packages/lib/ 2>/dev/null || true && \
    # Create empty files to ensure directories aren't empty
    touch /edge-packages/lib/.keep && \
    touch /edge-packages/bin/.keep && \
    touch /edge-packages/etc/.keep

# Build packages from source that aren't in Edge
FROM alpine:3.21 AS source-builder

# Install build tools and dependencies
RUN apk add --no-cache build-base autoconf automake libtool cmake \
    git python3-dev zlib-dev pkgconf bison flex perl linux-headers \
    xz gzip tar ca-certificates curl wget

# Create directory for our custom packages
WORKDIR /custom-packages
RUN mkdir -p /built-libs/bin /built-libs/lib /built-libs/include

# 1. Build libxml2 2.14.1
WORKDIR /custom-packages/libxml2
RUN git clone https://gitlab.gnome.org/GNOME/libxml2.git . && \
    git checkout v2.14.1 && \
    ./autogen.sh --prefix=/usr && \
    ./configure --prefix=/usr && \
    make -j$(nproc) && \
    make install DESTDIR=/built-libs

# 2. Build LCMS2 2.17
WORKDIR /custom-packages/lcms2
RUN wget https://sourceforge.net/projects/lcms/files/lcms/2.17/lcms2-2.17.tar.gz && \
    tar -xf lcms2-2.17.tar.gz && \
    cd lcms2-2.17 && \
    ./configure --prefix=/usr && \
    make -j$(nproc) && \
    make install DESTDIR=/built-libs

# Installer stage
FROM base AS installer

# Enable corepack and prepare pnpm
RUN npm install -g corepack@latest
RUN corepack enable

# Create directories to ensure they exist
RUN mkdir -p /usr/lib /usr/bin /etc/ssl

# Copy edge packages - fixed syntax
COPY --from=edge-packages /edge-packages/lib /usr/lib
COPY --from=edge-packages /edge-packages/bin /usr/bin
COPY --from=edge-packages /edge-packages/etc /etc

# Copy source-built packages
COPY --from=source-builder /built-libs /

# Install necessary build tools and compilers
RUN apk update && apk add --no-cache cmake g++ gcc jq make python3


# The rest of your Dockerfile remains the same
# BuildKit secret handling without hardcoded fallback values
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

# Runner stage
FROM base AS runner

# The rest of your Dockerfile remains unchanged
RUN npm install -g corepack@latest
RUN corepack enable

COPY --from=edge-packages /edge-packages/lib /usr/lib
COPY --from=edge-packages /edge-packages/bin /usr/bin
COPY --from=edge-packages /edge-packages/etc /etc
COPY --from=source-builder /built-libs /

RUN apk add --no-cache curl \
    && apk add --no-cache supercronic \
    && addgroup -S nextjs \
    && adduser -S -u 1001 -G nextjs nextjs

RUN echo "Verifying package versions:" && \
    openssl version | grep "3.5.0" && \
    sqlite3 --version | grep "3.49.1" && \
    pkg-config --modversion glib-2.0 | grep "2.84.1" && \
    xml2-config --version | grep "2.14.1" && \
    echo "All package versions verified successfully!"


WORKDIR /home/nextjs

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

RUN npm install -g tsx typescript prisma pino-pretty

EXPOSE 3000
ENV HOSTNAME "0.0.0.0"
ENV NODE_ENV="production"
# USER nextjs

# Prepare volume for uploads
RUN mkdir -p /home/nextjs/apps/web/uploads/
VOLUME /home/nextjs/apps/web/uploads/

# Prepare volume for SAML preloaded connection
RUN mkdir -p /home/nextjs/apps/web/saml-connection
VOLUME /home/nextjs/apps/web/saml-connection

CMD if [ "${DOCKER_CRON_ENABLED:-1}" = "1" ]; then \
      echo "Starting cron jobs..."; \
      supercronic -quiet /app/docker/cronjobs & \
    else \
      echo "Docker cron jobs are disabled via DOCKER_CRON_ENABLED=0"; \
    fi; \
    (cd packages/database && npm run db:migrate:deploy) && \
    (cd packages/database && npm run db:create-saml-database:deploy) && \
    exec node apps/web/server.js