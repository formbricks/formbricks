FROM node:18-alpine AS installer
RUN corepack enable && corepack prepare pnpm@latest --activate

ARG NEXT_PUBLIC_PRIVACY_URL
ENV NEXT_PUBLIC_PRIVACY_URL=$NEXT_PUBLIC_PRIVACY_URL

ARG NEXT_PUBLIC_TERMS_URL
ENV NEXT_PUBLIC_TERMS_URL=$NEXT_PUBLIC_TERMS_URL

ARG NEXT_PUBLIC_IMPRINT_URL
ENV NEXT_PUBLIC_IMPRINT_URL=$NEXT_PUBLIC_IMPRINT_URL

ARG NEXT_PUBLIC_WEBAPP_URL
ENV NEXT_PUBLIC_WEBAPP_URL=$NEXT_PUBLIC_WEBAPP_URL

ARG NEXT_PUBLIC_SURVEY_BASE_URL
ENV NEXT_PUBLIC_SURVEY_BASE_URL=$NEXT_PUBLIC_SURVEY_BASE_URL

ARG NEXT_PUBLIC_EMAIL_VERIFICATION_DISABLED
ENV NEXT_PUBLIC_EMAIL_VERIFICATION_DISABLED=$NEXT_PUBLIC_EMAIL_VERIFICATION_DISABLED

ARG NEXT_PUBLIC_PASSWORD_RESET_DISABLED
ENV NEXT_PUBLIC_PASSWORD_RESET_DISABLED=$NEXT_PUBLIC_PASSWORD_RESET_DISABLED

ARG NEXT_PUBLIC_SIGNUP_DISABLED
ENV NEXT_PUBLIC_SIGNUP_DISABLED=$NEXT_PUBLIC_SIGNUP_DISABLED

ARG NEXT_PUBLIC_INVITE_DISABLED
ENV NEXT_PUBLIC_INVITE_DISABLED=$NEXT_PUBLIC_INVITE_DISABLED

ARG WEBAPP_URL
ENV WEBAPP_URL=$WEBAPP_URL

ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL

ARG NEXTAUTH_SECRET
ENV NEXTAUTH_SECRET=$NEXTAUTH_SECRET

ARG NEXTAUTH_URL
ENV NEXTAUTH_URL=$NEXTAUTH_URL

ARG SENTRY_IGNORE_API_RESOLUTION_ERROR
ENV SENTRY_IGNORE_API_RESOLUTION_ERROR=$SENTRY_IGNORE_API_RESOLUTION_ERROR

ARG NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN

ARG NEXT_PUBLIC_GITHUB_AUTH_ENABLED
ENV NEXT_PUBLIC_GITHUB_AUTH_ENABLED=$NEXT_PUBLIC_GITHUB_AUTH_ENABLED

ARG GITHUB_ID
ENV GITHUB_ID=$GITHUB_ID

ARG GITHUB_SECRET
ENV GITHUB_SECRET=$GITHUB_SECRET

ARG NEXT_PUBLIC_GOOGLE_AUTH_ENABLED
ENV NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=$NEXT_PUBLIC_GOOGLE_AUTH_ENABLED

ARG GOOGLE_CLIENT_ID
ENV GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID

ARG GOOGLE_CLIENT_SECRET
ENV GOOGLE_CLIENT_SECRET=$GOOGLE_CLIENT_SECRET

ARG CRON_SECRET
ENV CRON_SECRET=$CRON_SECRET

WORKDIR /app

COPY . .
RUN touch /app/apps/web/.env


RUN pnpm install

# Build the project
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

CMD if [ "$NEXTAUTH_SECRET" != "RANDOM_STRING" ]; then \
        pnpm dlx prisma migrate deploy && node apps/web/server.js; \
    else \
        echo "ERROR: Please set a value for NEXTAUTH_SECRET in your docker compose variables!"; \
        exit 1; \
    fi
