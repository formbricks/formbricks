FROM node:22-alpine3.21 AS base

# Add a new stage for building custom packages
FROM alpine:3.21 AS package-builder

# Install build tools and dependencies
RUN apk add --no-cache alpine-sdk build-base autoconf automake libtool cmake \
    git python3-dev zlib-dev pkgconf bison flex perl linux-headers \
    xz gzip tar ca-certificates curl wget meson ninja

# Create directory for our custom packages
WORKDIR /custom-packages
RUN mkdir -p /repo/x86_64

# Setup abuild for package signing
RUN adduser -D builder && \
    addgroup builder abuild && \
    mkdir -p /var/cache/distfiles && \
    chmod a+w /var/cache/distfiles && \
    echo "builder ALL=(ALL) NOPASSWD: ALL" >> /etc/sudoers

# Switch to builder user for abuild
USER builder
RUN abuild-keygen -a -n -i

# 1. Build libxml2 2.14.1
WORKDIR /custom-packages/libxml2
RUN git clone https://gitlab.gnome.org/GNOME/libxml2.git . && \
    git checkout v2.14.1 && \
    ./autogen.sh --prefix=/usr && \
    ./configure --prefix=/usr && \
    make -j$(nproc) && \
    DESTDIR=/tmp/libxml2 make install

# 2. Build OpenSSL 3.5.0
WORKDIR /custom-packages/openssl
RUN wget https://www.openssl.org/source/openssl-3.5.0.tar.gz && \
    tar -xf openssl-3.5.0.tar.gz && \
    cd openssl-3.5.0 && \
    ./config --prefix=/usr --openssldir=/etc/ssl && \
    make -j$(nproc) && \
    DESTDIR=/tmp/openssl make install_sw

# 3. Build SQLite 3.49.1
WORKDIR /custom-packages/sqlite
RUN wget https://www.sqlite.org/2025/sqlite-autoconf-3491100.tar.gz && \
    tar -xf sqlite-autoconf-3491100.tar.gz && \
    cd sqlite-autoconf-3491100 && \
    ./configure --prefix=/usr && \
    make -j$(nproc) && \
    DESTDIR=/tmp/sqlite make install

# 4. Build GLib 2.84.1
WORKDIR /custom-packages/glib
RUN wget https://download.gnome.org/sources/glib/2.84/glib-2.84.1.tar.xz && \
    tar -xf glib-2.84.1.tar.xz && \
    cd glib-2.84.1 && \
    mkdir build && cd build && \
    meson setup --prefix=/usr .. && \
    ninja && \
    DESTDIR=/tmp/glib ninja install

# 5. Build LCMS2 2.17
WORKDIR /custom-packages/lcms2
RUN wget https://sourceforge.net/projects/lcms/files/lcms/2.17/lcms2-2.17.tar.gz && \
    tar -xf lcms2-2.17.tar.gz && \
    cd lcms2-2.17 && \
    ./configure --prefix=/usr && \
    make -j$(nproc) && \
    DESTDIR=/tmp/lcms2 make install

# Switch back to root for creating packages
USER root

# Create APK packages from the built software
WORKDIR /custom-packages
RUN cd /tmp/libxml2 && tar -czf /repo/x86_64/libxml2-2.14.1-r0.apk . && \
    cd /tmp/openssl && tar -czf /repo/x86_64/openssl-3.5.0-r0.apk . && \
    cd /tmp/sqlite && tar -czf /repo/x86_64/sqlite-3.49.1-r0.apk . && \
    cd /tmp/glib && tar -czf /repo/x86_64/glib-2.84.1-r0.apk . && \
    cd /tmp/lcms2 && tar -czf /repo/x86_64/lcms2-2.17-r0.apk .

# Create repository index
WORKDIR /repo/x86_64
RUN apk index -o APKINDEX.tar.gz *.apk && \
    abuild-sign -k /home/builder/.abuild/*.rsa APKINDEX.tar.gz

# Your original installer stage
FROM base AS installer

# Enable corepack and prepare pnpm
RUN npm install -g corepack@latest
RUN corepack enable

# Create directory for our custom repository
RUN mkdir -p /var/lib/custom-repo/x86_64

# Copy our custom packages and repository index
COPY --from=package-builder /repo/x86_64/*.apk /var/lib/custom-repo/x86_64/
COPY --from=package-builder /repo/x86_64/APKINDEX.tar.gz /var/lib/custom-repo/x86_64/
COPY --from=package-builder /home/builder/.abuild/*.pub /etc/apk/keys/

# Configure APK to use our custom repository first
RUN echo "file:///var/lib/custom-repo/x86_64" > /etc/apk/repositories && \
    echo "https://dl-cdn.alpinelinux.org/alpine/v3.21/main" >> /etc/apk/repositories && \
    echo "https://dl-cdn.alpinelinux.org/alpine/v3.21/community" >> /etc/apk/repositories

# Update APK database
RUN apk update

# Install our custom packages and other dependencies
RUN apk add --allow-untrusted --no-cache \
    libxml2=2.14.1-r0 \
    openssl=3.5.0-r0 \
    sqlite=3.49.1-r0 \
    glib=2.84.1-r0 \
    lcms2=2.17-r0 \
    cmake g++ gcc jq make python3

# Install necessary build tools and compilers
RUN apk add --no-cache openssl-dev

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

# Your original runner stage
FROM base AS runner

RUN npm install -g corepack@latest
RUN corepack enable

RUN apk add --no-cache curl \
    && apk add --no-cache supercronic \
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