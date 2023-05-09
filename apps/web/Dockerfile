FROM node:18.16-alpine AS installer
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY . .

# Set up a case-sensitive volume for node_modules
VOLUME /app/node_modules

RUN pnpm install
# Build the project
RUN pnpm dlx prisma generate
RUN pnpm turbo run build --filter=web...

CMD pnpm dlx prisma migrate deploy && node /app/apps/web/.next/standalone/apps/web/server.js
