FROM node:18.16-alpine AS installer
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY . .

RUN pnpm install
# Build the project
RUN pnpm turbo run build --filter=web...

CMD pnpm dlx prisma migrate deploy && node /app/apps/web/.next/standalone/apps/web/server.js