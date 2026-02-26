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
RUN npm install --ignore-scripts -g corepack@latest 
RUN corepack enable
RUN corepack prepare pnpm@10.28.2 --activate

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
RUN pnpm install --ignore-scripts

# Build the database package first
RUN pnpm build --filter=@formbricks/database

# Build the project using our secret reader script
# This mounts the secrets only during this build step without storing them in layers
RUN --mount=type=secret,id=database_url \
    --mount=type=secret,id=encryption_key \
    --mount=type=secret,id=redis_url \
    --mount=type=secret,id=sentry_auth_token \
    /tmp/read-secrets.sh pnpm build --filter=@formbricks/web...

#
## step 3: setup production runner
#
FROM base AS runner

# Update npm to latest, then create user
# Note: npm's bundled tar has a known vulnerability but npm is only used during build, not at runtime
RUN npm install --ignore-scripts -g npm@latest \
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

# Create packages/database directory structure with proper ownership for runtime migrations
RUN mkdir -p ./packages/database/migrations && chown -R nextjs:nextjs ./packages/database

COPY --from=installer /app/packages/database/package.json ./packages/database/package.json
RUN chown nextjs:nextjs ./packages/database/package.json && chmod 644 ./packages/database/package.json

COPY --from=installer /app/packages/database/schema.prisma ./packages/database/schema.prisma
RUN chown nextjs:nextjs ./packages/database/schema.prisma && chmod 644 ./packages/database/schema.prisma

COPY --from=installer /app/packages/database/dist ./packages/database/dist
RUN chown -R nextjs:nextjs ./packages/database/dist && chmod -R 755 ./packages/database/dist

# Copy prisma client packages
COPY --from=installer /app/node_modules/@prisma/client ./node_modules/@prisma/client
RUN chown -R nextjs:nextjs ./node_modules/@prisma/client && chmod -R 755 ./node_modules/@prisma/client

COPY --from=installer /app/node_modules/.prisma ./node_modules/.prisma
RUN chown -R nextjs:nextjs ./node_modules/.prisma && chmod -R 755 ./node_modules/.prisma

COPY --from=installer /app/node_modules/@paralleldrive/cuid2 ./node_modules/@paralleldrive/cuid2
RUN chmod -R 755 ./node_modules/@paralleldrive/cuid2

COPY --from=installer /app/node_modules/uuid ./node_modules/uuid
RUN chmod -R 755 ./node_modules/uuid

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

# Install prisma CLI globally for database migrations and fix permissions for nextjs user
RUN npm install --ignore-scripts -g prisma@6 \
    && chown -R nextjs:nextjs /usr/local/lib/node_modules/prisma

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