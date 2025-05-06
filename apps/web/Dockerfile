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

# Install necessary build tools and compilers
RUN apk update && apk add --no-cache cmake g++ gcc jq make openssl-dev python3

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