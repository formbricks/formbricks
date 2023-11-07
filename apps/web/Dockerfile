# Use the official Node.js image as a base image for the installer stage
FROM node:18-alpine AS installer

# Install system dependencies and tools
RUN apk add --no-cache --virtual .build-deps \
        g++ \
        gcc \
        libgcc \
        libstdc++ \
        linux-headers \
        make \
        python3 \
        cmake

# Enable corepack and prepare pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Set environment variables
ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL

ARG NEXTAUTH_SECRET
ENV NEXTAUTH_SECRET=$NEXTAUTH_SECRET

ARG ENCRYPTION_KEY
ENV ENCRYPTION_KEY=$ENCRYPTION_KEY

WORKDIR /app

COPY . .

# Create an empty .env file
RUN touch /app/apps/web/.env

# Install your application dependencies
RUN pnpm install

# Build the project
RUN pnpm post-install --filter=web...
RUN pnpm turbo run build --filter=web...

# Use a different base image for the runner stage
FROM node:18-alpine AS runner

# Enable corepack and prepare pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Create a non-root user for running the application
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
USER nextjs

WORKDIR /home/nextjs

# Copy configuration files and built artifacts from the installer stage
COPY --from=installer /app/apps/web/next.config.mjs .
COPY --from=installer /app/apps/web/package.json .

# Copy the built application files
COPY --from=installer --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=installer --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=installer --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
COPY --from=installer --chown=nextjs:nodejs /app/packages/database/schema.prisma ./packages/database/schema.prisma
COPY --from=installer --chown=nextjs:nodejs /app/packages/database/migrations ./packages/database/migrations

EXPOSE 3000

ENV HOSTNAME "0.0.0.0"

USER root

# Install cron and set up cron jobs
RUN apk --no-cache add dcron

# Create a cron directory inside the container
RUN mkdir /cron

# Copy all the cron job YAML files
COPY .github/workflows/cron-* /cron/

# Copy your entrypoint.sh script into the container
COPY /apps/web/entrypoint.sh /entrypoint.sh

# Make the script executable
RUN chmod +x /entrypoint.sh

USER nextjs

# Combine all cron job schedules and your entrypoint script in a single CMD
CMD ["/entrypoint.sh"]
