FROM node:20-alpine AS base

#
## step 1: Prune monorepo
#
FROM base AS builder
RUN apk add --no-cache libc6-compat
RUN apk update
# Set working directory
WORKDIR /app
RUN yarn global add turbo
COPY . .
RUN turbo prune @formbricks/database --docker

#
## step 2: Install & build
#
FROM base AS runner

WORKDIR /app

# Enable corepack and prepare pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL

ARG UPGRADE_TO_VERSION
ENV UPGRADE_TO_VERSION=$UPGRADE_TO_VERSION

# Install necessary build tools and compilers
# RUN apk update && apk add --no-cache g++ cmake make gcc python3 openssl-dev

COPY --from=builder /app/out/full/ .

RUN pnpm install

CMD ["sh", "-c", "cd packages/database && pnpm data-migration:${UPGRADE_TO_VERSION}"]