FROM node:18.16 AS installer
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json .env /app/
COPY apps/web /app/apps/web
COPY packages /app/packages

# Set up a case-sensitive volume for node_modules
VOLUME /app/node_modules

RUN pnpm install
RUN pnpm dlx prisma generate

RUN ls node_modules/.prisma

RUN pnpm turbo run build --filter=web...

CMD pnpm dlx prisma migrate deploy && node /app/apps/web/.next/standalone/apps/web/server.js