FROM node:18-alpine AS installer
RUN corepack enable && corepack prepare pnpm@latest --activate

ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL

ARG NEXTAUTH_SECRET
ENV NEXTAUTH_SECRET=$NEXTAUTH_SECRET

WORKDIR /app

COPY . .
RUN touch /app/apps/web/.env


RUN pnpm install

# Build the project
ENV DOCKER_BUILD 1
ENV NEXT_TELEMETRY_DISABLED 1

RUN pnpm post-install --filter=web...
RUN pnpm turbo run build --filter=web...

FROM node:18-alpine AS runner
RUN corepack enable && corepack prepare pnpm@latest --activate

# Don't run production as root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
USER nextjs

WORKDIR /home/nextjs

COPY --from=installer /app/apps/web/next.config.mjs .
COPY --from=installer /app/apps/web/package.json .

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=installer --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=installer --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=installer --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
COPY --from=installer --chown=nextjs:nodejs /app/packages/database/schema.prisma ./packages/database/schema.prisma
COPY --from=installer --chown=nextjs:nodejs /app/packages/database/migrations ./packages/database/migrations

EXPOSE 3000

ENV HOSTNAME "0.0.0.0"

CMD if [ "$NEXTAUTH_SECRET" != "RANDOM_STRING" ]; then \
    pnpm dlx prisma migrate deploy && node apps/web/server.js; \
    else \
    echo "ERROR: Please set a value for NEXTAUTH_SECRET in your docker compose variables!"; \
    exit 1; \
    fi
