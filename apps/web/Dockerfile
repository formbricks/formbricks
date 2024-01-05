# Installer stage: Building the application
FROM node:20-alpine AS installer

# Enable corepack and prepare pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Install necessary build tools and compilers
RUN apk update && apk add --no-cache g++ cmake make gcc python3 openssl-dev

# Install Supercronic (cron for containers without super user privileges)
RUN apk add --no-cache curl \
    && curl -fsSLo /tmp/supercronic \
       "https://github.com/aptible/supercronic/releases/download/v0.2.27/supercronic-linux-amd64" \
    && chmod +x /tmp/supercronic

# Set environment variables
ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL

ARG NEXTAUTH_SECRET
ENV NEXTAUTH_SECRET=$NEXTAUTH_SECRET

ARG ENCRYPTION_KEY
ENV ENCRYPTION_KEY=$ENCRYPTION_KEY

# Set the working directory
WORKDIR /app

# Copy the application files
COPY . .

# Create a .env file
RUN touch /app/apps/web/.env

# Install the dependencies
RUN pnpm install


# Build the project
RUN pnpm post-install --filter=web...
RUN pnpm turbo run build --filter=web...

# Runner stage: Setting up the runtime environment
FROM node:20-alpine AS runner
RUN corepack enable && corepack prepare pnpm@latest --activate

RUN apk add --no-cache curl \
    # && addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

WORKDIR /home/nextjs

COPY --from=installer /tmp/supercronic /usr/local/bin/supercronic
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
USER nextjs

# Prepare volume for uploads
RUN mkdir -p /home/nextjs/apps/web/uploads/
VOLUME /home/nextjs/apps/web/uploads/

CMD supercronic -quiet /app/docker/cronjobs & \
    if [ "$NEXTAUTH_SECRET" != "RANDOM_STRING" ]; then \
        pnpm dlx prisma migrate deploy && \
        exec node apps/web/server.js; \
    else \
        echo "ERROR: Please set a value for NEXTAUTH_SECRET in your docker compose variables!" >&2; \
        exit 1; \
    fi