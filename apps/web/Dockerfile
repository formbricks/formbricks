FROM node:18-alpine AS installer
RUN corepack enable && corepack prepare pnpm@latest --activate

ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL

ARG NEXTAUTH_SECRET
ENV NEXTAUTH_SECRET=$NEXTAUTH_SECRET

ARG ENCRYPTION_KEY
ENV ENCRYPTION_KEY=b19a492fe2a9c01debe543f945d8481728e126904f5b54acc53eb0936748fb02

WORKDIR /app

COPY . .
RUN touch /app/apps/web/.env

RUN pnpm install

# Build the project
RUN pnpm post-install --filter=web...
RUN pnpm turbo run build --filter=web...

FROM node:18-alpine AS runner
RUN corepack enable && corepack prepare pnpm@latest --activate

# Install sudo if necessary
RUN apk add --no-cache sudo curl

# USER root

# RUN chmod u+s /usr/bin/crontab

RUN env >> /etc/environment

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

WORKDIR /home/nextjs

COPY --from=installer /app/apps/web/next.config.mjs .
COPY --from=installer /app/apps/web/package.json .

# Leverage output traces to reduce image size
COPY --from=installer --chown=nextjs:nextjs /app/apps/web/.next/standalone ./
COPY --from=installer --chown=nextjs:nextjs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=installer --chown=nextjs:nextjs /app/apps/web/public ./apps/web/public
COPY --from=installer --chown=nextjs:nextjs /app/packages/database/schema.prisma ./packages/database/schema.prisma
COPY --from=installer --chown=nextjs:nextjs /app/packages/database/migrations ./packages/database/migrations
COPY --from=installer /app/docker/cronjobs /app/docker/cronjobs

EXPOSE 3000

ENV HOSTNAME "0.0.0.0"

CMD crontab /app/docker/cronjobs && \
    crond -d 8 -f & \
    su -s /bin/sh nextjs -c ' \
        if [ "$NEXTAUTH_SECRET" != "RANDOM_STRING" ]; then \
            pnpm dlx prisma migrate deploy && \
            exec node apps/web/server.js; \
        else \
            echo "ERROR: Please set a value for NEXTAUTH_SECRET in your docker compose variables!"; \
            exit 1; \
        fi'
