# Add lockfile and package.json's of isolated subworkspace
FROM --platform=linux/amd64 node:16-alpine AS installer
WORKDIR /app

RUN apk update
RUN apk --no-cache add curl libc6-compat
RUN curl -fsSL "https://github.com/pnpm/pnpm/releases/latest/download/pnpm-linuxstatic-x64" -o /bin/pnpm; chmod +x /bin/pnpm;

# First install the dependencies (as they change less often)
COPY . .
RUN pnpm install

# Build the project
RUN pnpm dlx prisma generate
RUN pnpm turbo run build --filter=hq...

FROM --platform=linux/amd64 node:16-alpine AS runner

RUN apk update
RUN apk --no-cache add curl libc6-compat
RUN curl -fsSL "https://github.com/pnpm/pnpm/releases/latest/download/pnpm-linuxstatic-x64" -o /bin/pnpm; chmod +x /bin/pnpm;

# Don't run production as root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
USER nextjs

WORKDIR /home/nextjs

COPY --from=installer /app/apps/hq .

COPY --from=installer --chown=nextjs:nodejs /app/packages/database/prisma/schema.prisma ./packages/database/prisma/schema.prisma

USER nextjs

EXPOSE 3000

CMD pnpm dlx prisma migrate deploy && pnpm start --filter=hq...