# Add lockfile and package.json's of isolated subworkspace
FROM node:16-alpine AS installer
RUN apk update
RUN apk --no-cache add curl libc6-compat
RUN curl -fsSL "https://github.com/pnpm/pnpm/releases/latest/download/pnpm-linuxstatic-x64" -o /bin/pnpm; chmod +x /bin/pnpm;
WORKDIR /app

# First install the dependencies (as they change less often)
COPY . .
RUN pnpm install

# Build the project
RUN pnpm dlx prisma generate
RUN pnpm turbo run build --filter=web...

FROM node:16-alpine AS runner

RUN apk --no-cache add curl libc6-compat
RUN curl -fsSL "https://github.com/pnpm/pnpm/releases/latest/download/pnpm-linuxstatic-x64" -o /bin/pnpm; chmod +x /bin/pnpm;

# Don't run production as root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
USER nextjs

WORKDIR /home/nextjs

COPY --from=installer /app/apps/web/next.config.js .
COPY --from=installer /app/apps/web/package.json .

# Automatically leverage output traces to reduce image size 
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=installer --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=installer --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=installer --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
COPY --from=installer --chown=nextjs:nodejs /.env ./apps/web/.env
COPY --from=installer --chown=nextjs:nodejs /app/packages/database/prisma ./packages/database/prisma

CMD pnpm dlx prisma migrate deploy && node apps/web/server.js