FROM node:22-alpine3.20@sha256:40be979442621049f40b1d51a26b55e281246b5de4e5f51a18da7beb6e17e3f9 AS base

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

# Install necessary build tools and compilers
RUN apk update && apk add --no-cache g++ cmake make gcc python3 openssl-dev jq

# Set hardcoded environment variables
ENV DATABASE_URL="postgresql://placeholder:for@build:5432/gets_overwritten_at_runtime?schema=public"
ENV NEXTAUTH_SECRET="placeholder_for_next_auth_of_64_chars_get_overwritten_at_runtime"
ENV ENCRYPTION_KEY="placeholder_for_build_key_of_64_chars_get_overwritten_at_runtime"
ENV CRON_SECRET="placeholder_for_cron_secret_of_64_chars_get_overwritten_at_runtime"

ARG NEXT_PUBLIC_SENTRY_DSN
ARG SENTRY_AUTH_TOKEN

# Increase Node.js memory limit
# ENV NODE_OPTIONS="--max_old_space_size=4096"

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

# Build the project and logger
RUN NODE_OPTIONS="--max_old_space_size=4096" pnpm build --filter=@formbricks/web...

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
    # && addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

WORKDIR /home/nextjs

COPY --from=installer /app/apps/web/next.config.mjs .
COPY --from=installer /app/apps/web/package.json .
# Leverage output traces to reduce image size

COPY --from=installer --chown=nextjs:nextjs /app/apps/web/.next/standalone ./
COPY --from=installer --chown=nextjs:nextjs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=installer --chown=nextjs:nextjs /app/apps/web/public ./apps/web/public
COPY --from=installer --chown=nextjs:nextjs /app/packages/database/schema.prisma ./packages/database/schema.prisma
COPY --from=installer --chown=nextjs:nextjs /app/packages/database/package.json ./packages/database/package.json
COPY --from=installer --chown=nextjs:nextjs /app/packages/database/migration ./packages/database/migration
COPY --from=installer --chown=nextjs:nextjs /app/packages/database/src ./packages/database/src
COPY --from=installer --chown=nextjs:nextjs /app/packages/database/node_modules ./packages/database/node_modules
COPY --from=installer --chown=nextjs:nextjs /app/packages/logger/dist ./packages/database/node_modules/@formbricks/logger/dist

# Set up logger package structure properly for CommonJS/ESM compatibility
# COPY --from=installer --chown=nextjs:nextjs /app/packages/logger/package.json ./packages/logger/package.json
# COPY --from=installer --chown=nextjs:nextjs /app/packages/logger/dist ./packages/logger/dist

# Create a node_modules directory for the database package
# RUN mkdir -p ./packages/database/node_modules/@formbricks
# Symlink the logger package for proper Node.js module resolution
# RUN ln -s ../../../../packages/logger ./packages/database/node_modules/@formbricks/logger

# Copy Prisma-specific generated files
COPY --from=installer --chown=nextjs:nextjs /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=installer --chown=nextjs:nextjs /app/node_modules/.prisma ./node_modules/.prisma

COPY --from=installer --chown=nextjs:nextjs /prisma_version.txt .
COPY /docker/cronjobs /app/docker/cronjobs

# Copy required dependencies
COPY --from=installer /app/node_modules/@paralleldrive/cuid2 ./node_modules/@paralleldrive/cuid2
COPY --from=installer /app/node_modules/@noble/hashes ./node_modules/@noble/hashes
COPY --from=installer /app/node_modules/zod ./node_modules/zod

# log the contents of the database node_modules
RUN ls -la ./packages/database/node_modules/@formbricks/logger

RUN npm install -g tsx typescript prisma

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
