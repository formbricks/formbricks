FROM node:22-alpine3.21 AS base

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
ADD https://github.com/mm2/Little-CMS/archive/refs/tags/lcms2.17.tar.gz lcms2.17.tar.gz
RUN tar -xf lcms2.17.tar.gz && \
    cd Little-CMS-lcms2.17 && \
    ./configure --prefix=/usr && \
    make -j$(nproc) && \
    make install DESTDIR=/built-libs

# 3. Build c-ares 1.3.0
WORKDIR /custom-packages/c-ares
ADD https://github.com/c-ares/c-ares/releases/download/cares-1_3_0/c-ares-1.3.0.tar.gz c-ares-1.3.0.tar.gz
RUN tar -xf c-ares-1.3.0.tar.gz && \
    cd c-ares-1.3.0 && \
    ./configure --prefix=/usr && \
    make -j$(nproc) && \
    make install DESTDIR=/built-libs

# 4. Build libarchive 3.7.9
WORKDIR /custom-packages/libarchive
ADD https://github.com/libarchive/libarchive/releases/download/v3.7.9/libarchive-3.7.9.tar.gz libarchive-3.7.9.tar.gz
RUN tar -xf libarchive-3.7.9.tar.gz && \
    cd libarchive-3.7.9 && \
    ./configure --prefix=/usr && \
    make -j$(nproc) && \
    make install DESTDIR=/built-libs

# 5. Build sqlite 3.49.1
WORKDIR /custom-packages/sqlite
ADD https://www.sqlite.org/2024/sqlite-autoconf-3490100.tar.gz sqlite-autoconf-3490100.tar.gz
RUN tar -xf sqlite-autoconf-3490100.tar.gz && \
    cd sqlite-autoconf-3490100 && \
    ./configure --prefix=/usr && \
    make -j$(nproc) && \
    make install DESTDIR=/built-libs

# 6. Build v8 12.9.66680202-pgo
WORKDIR /custom-packages/v8
RUN apk add --no-cache git python3 ninja && \
    git clone https://chromium.googlesource.com/chromium/tools/depot_tools.git && \
    export PATH="$PWD/depot_tools:$PATH" && \
    fetch v8 && \
    cd v8 && \
    git checkout 12.9.66680202 && \
    gclient sync && \
    gn gen out/Release --args='is_debug=false is_component_build=false v8_use_external_startup_data=false v8_enable_i18n_support=false v8_static_library=true use_custom_libcxx=false use_custom_libcxx_for_host=false use_sysroot=false symbol_level=0 v8_enable_pointer_compression=false' && \
    ninja -C out/Release v8_monolith && \
    mkdir -p /built-libs/usr/lib /built-libs/usr/include/v8 && \
    cp out/Release/obj/libv8_monolith.a /built-libs/usr/lib/ && \
    cp -r include/* /built-libs/usr/include/v8/

# 7. Build zstd 1.5.6.7
WORKDIR /custom-packages/zstd
ADD https://github.com/facebook/zstd/releases/download/v1.5.6.7/zstd-1.5.6.7.tar.gz zstd-1.5.6.7.tar.gz
RUN tar -xf zstd-1.5.6.7.tar.gz && \
    cd zstd-1.5.6.7 && \
    make -j$(nproc) && \
    make install PREFIX=/usr DESTDIR=/built-libs

# 8. Build glib 2.84.1
WORKDIR /custom-packages/glib
RUN apk add --no-cache meson pkgconf && \
    git clone https://gitlab.gnome.org/GNOME/glib.git . && \
    git checkout 2.84.1 && \
    meson setup builddir --prefix=/usr && \
    meson compile -C builddir && \
    DESTDIR=/built-libs meson install -C builddir

# 9. Install Go 1.24.2
WORKDIR /custom-packages/go
ADD https://go.dev/dl/go1.24.2.linux-amd64.tar.gz go1.24.2.linux-amd64.tar.gz
RUN tar -C /built-libs/usr -xzf go1.24.2.linux-amd64.tar.gz

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

#
## step 3: setup production runner
#
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