FROM node:18-slim AS installer
RUN npm install -g pnpm

WORKDIR /app

# First install the dependencies (as they change less often)
COPY . .
# Copy .env file because Docker don't follow symlinks
COPY .env /app/apps/hq/

RUN pnpm install

# Build the project
RUN pnpm dlx prisma generate
RUN pnpm turbo run build --filter=hq...

FROM node:18-slim AS runner
RUN npm install -g pnpm

# Don't run production as root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
USER nextjs

WORKDIR /home/nextjs

COPY --from=installer /app/apps/hq/next.config.js .
COPY --from=installer /app/apps/hq/package.json .

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=installer --chown=nextjs:nodejs /app/apps/hq/.next/standalone ./
COPY --from=installer --chown=nextjs:nodejs /app/apps/hq/.next/static ./apps/hq/.next/static
COPY --from=installer --chown=nextjs:nodejs /app/apps/hq/public ./apps/hq/public
COPY --from=installer --chown=nextjs:nodejs /app/packages/database/prisma ./packages/database/prisma

CMD pnpm dlx prisma migrate deploy && node apps/hq/server.js