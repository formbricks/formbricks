FROM node:18-alpine AS installer
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY . .
# Copy .env file because Docker don't follow symlinks
COPY .env /app/apps/web/

RUN pnpm install

# Build the project
RUN pnpm prebuild --filter=web...
RUN pnpm turbo run build --filter=web...

FROM node:18-alpine AS runner
RUN corepack enable && corepack prepare pnpm@latest --activate

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
COPY --from=installer --chown=nextjs:nodejs /app/packages/database/schema.prisma ./packages/database/schema.prisma
COPY --from=installer --chown=nextjs:nodejs /app/packages/database/migrations ./packages/database/migrations

CMD pnpm dlx prisma migrate deploy && node apps/web/server.js