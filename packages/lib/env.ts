import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /*
   * Serverside Environment variables, not available on the client.
   * Will throw if you access these variables on the client.
   */
  server: {
    AIRTABLE_CLIENT_ID: z.string().optional(),
    AZUREAD_CLIENT_ID: z.string().optional(),
    AZUREAD_CLIENT_SECRET: z.string().optional(),
    AZUREAD_TENANT_ID: z.string().optional(),
    CRON_SECRET: z.string().min(10),
    CUSTOMER_IO_API_KEY: z.string().optional(),
    CUSTOMER_IO_SITE_ID: z.string().optional(),
    DATABASE_URL: z.string().url(),
    DEBUG: z.enum(["1", "0"]).optional(),
    DEFAULT_ORGANIZATION_ID: z.string().optional(),
    DEFAULT_ORGANIZATION_ROLE: z.enum(["owner", "admin", "editor", "developer", "viewer"]).optional(),
    E2E_TESTING: z.enum(["1", "0"]).optional(),
    EMAIL_AUTH_DISABLED: z.enum(["1", "0"]).optional(),
    EMAIL_VERIFICATION_DISABLED: z.enum(["1", "0"]).optional(),
    ENCRYPTION_KEY: z.string().length(64).or(z.string().length(32)),
    ENTERPRISE_LICENSE_KEY: z.string().optional(),
    FORMBRICKS_ENCRYPTION_KEY: z.string().length(24).or(z.string().length(0)).optional(),
    GITHUB_ID: z.string().optional(),
    GITHUB_SECRET: z.string().optional(),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GOOGLE_SHEETS_CLIENT_ID: z.string().optional(),
    GOOGLE_SHEETS_CLIENT_SECRET: z.string().optional(),
    GOOGLE_SHEETS_REDIRECT_URL: z.string().optional(),
    HTTP_PROXY: z.string().url().optional(),
    HTTPS_PROXY: z.string().url().optional(),
    IMPRINT_URL: z
      .string()
      .url()
      .optional()
      .or(z.string().refine((str) => str === "")),
    INVITE_DISABLED: z.enum(["1", "0"]).optional(),
    IS_FORMBRICKS_CLOUD: z.enum(["1", "0"]).optional(),
    MAIL_FROM: z.string().email().optional(),
    NEXTAUTH_SECRET: z.string().min(1),
    NOTION_OAUTH_CLIENT_ID: z.string().optional(),
    NOTION_OAUTH_CLIENT_SECRET: z.string().optional(),
    OIDC_CLIENT_ID: z.string().optional(),
    OIDC_CLIENT_SECRET: z.string().optional(),
    OIDC_DISPLAY_NAME: z.string().optional(),
    OIDC_ISSUER: z.string().optional(),
    OIDC_SIGNING_ALGORITHM: z.string().optional(),
    OPENTELEMETRY_LISTENER_URL: z.string().optional(),
    REDIS_URL: z.string().optional(),
    REDIS_HTTP_URL: z.string().optional(),
    PASSWORD_RESET_DISABLED: z.enum(["1", "0"]).optional(),
    PRIVACY_URL: z
      .string()
      .url()
      .optional()
      .or(z.string().refine((str) => str === "")),
    RATE_LIMITING_DISABLED: z.enum(["1", "0"]).optional(),
    S3_ACCESS_KEY: z.string().optional(),
    S3_BUCKET_NAME: z.string().optional(),
    S3_REGION: z.string().optional(),
    S3_SECRET_KEY: z.string().optional(),
    S3_ENDPOINT_URL: z.string().optional(),
    S3_FORCE_PATH_STYLE: z.enum(["1", "0"]).optional(),
    SHORT_URL_BASE: z.string().url().optional().or(z.string().length(0)),
    SIGNUP_DISABLED: z.enum(["1", "0"]).optional(),
    SLACK_CLIENT_ID: z.string().optional(),
    SLACK_CLIENT_SECRET: z.string().optional(),
    SMTP_HOST: z.string().min(1).optional(),
    SMTP_PASSWORD: z.string().min(1).optional(),
    SMTP_PORT: z.string().min(1).optional(),
    SMTP_SECURE_ENABLED: z.enum(["1", "0"]).optional(),
    SMTP_USER: z.string().min(1).optional(),
    SMTP_REJECT_UNAUTHORIZED_TLS: z.enum(["1", "0"]).optional(),
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    TELEMETRY_DISABLED: z.enum(["1", "0"]).optional(),
    TERMS_URL: z
      .string()
      .url()
      .optional()
      .or(z.string().refine((str) => str === "")),
    UPLOADS_DIR: z.string().min(1).optional(),
    VERCEL_URL: z.string().optional(),
    WEBAPP_URL: z.string().url().optional(),
    UNSPLASH_ACCESS_KEY: z.string().optional(),
  },

  /*
   * Environment variables available on the client (and server).
   *
   * 💡 You'll get type errors if these are not prefixed with NEXT_PUBLIC_.
   */
  client: {
    NEXT_PUBLIC_FORMBRICKS_API_HOST: z
      .string()
      .url()
      .optional()
      .or(z.string().refine((str) => str === "")),
    NEXT_PUBLIC_FORMBRICKS_ENVIRONMENT_ID: z.string().optional(),
    NEXT_PUBLIC_FORMBRICKS_ONBOARDING_SURVEY_ID: z.string().optional(),
    NEXT_PUBLIC_POSTHOG_API_KEY: z.string().optional(),
    NEXT_PUBLIC_POSTHOG_API_HOST: z.string().optional(),
    NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  },
  /*
   * Due to how Next.js bundles environment variables on Edge and Client,
   * we need to manually destructure them to make sure all are included in bundle.
   *
   * 💡 You'll get type errors if not all variables from `server` & `client` are included here.
   */
  runtimeEnv: {
    AIRTABLE_CLIENT_ID: process.env.AIRTABLE_CLIENT_ID,
    AZUREAD_CLIENT_ID: process.env.AZUREAD_CLIENT_ID,
    AZUREAD_CLIENT_SECRET: process.env.AZUREAD_CLIENT_SECRET,
    AZUREAD_TENANT_ID: process.env.AZUREAD_TENANT_ID,
    CRON_SECRET: process.env.CRON_SECRET,
    CUSTOMER_IO_API_KEY: process.env.CUSTOMER_IO_API_KEY,
    CUSTOMER_IO_SITE_ID: process.env.CUSTOMER_IO_SITE_ID,
    DATABASE_URL: process.env.DATABASE_URL,
    DEBUG: process.env.DEBUG,
    DEFAULT_ORGANIZATION_ID: process.env.DEFAULT_ORGANIZATION_ID,
    DEFAULT_ORGANIZATION_ROLE: process.env.DEFAULT_ORGANIZATION_ROLE,
    E2E_TESTING: process.env.E2E_TESTING,
    EMAIL_AUTH_DISABLED: process.env.EMAIL_AUTH_DISABLED,
    EMAIL_VERIFICATION_DISABLED: process.env.EMAIL_VERIFICATION_DISABLED,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
    ENTERPRISE_LICENSE_KEY: process.env.ENTERPRISE_LICENSE_KEY,
    FORMBRICKS_ENCRYPTION_KEY: process.env.FORMBRICKS_ENCRYPTION_KEY,
    GITHUB_ID: process.env.GITHUB_ID,
    GITHUB_SECRET: process.env.GITHUB_SECRET,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_SHEETS_CLIENT_ID: process.env.GOOGLE_SHEETS_CLIENT_ID,
    GOOGLE_SHEETS_CLIENT_SECRET: process.env.GOOGLE_SHEETS_CLIENT_SECRET,
    GOOGLE_SHEETS_REDIRECT_URL: process.env.GOOGLE_SHEETS_REDIRECT_URL,
    HTTP_PROXY: process.env.HTTP_PROXY,
    HTTPS_PROXY: process.env.HTTPS_PROXY,
    IMPRINT_URL: process.env.IMPRINT_URL,
    INVITE_DISABLED: process.env.INVITE_DISABLED,
    IS_FORMBRICKS_CLOUD: process.env.IS_FORMBRICKS_CLOUD,
    MAIL_FROM: process.env.MAIL_FROM,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXT_PUBLIC_FORMBRICKS_API_HOST: process.env.NEXT_PUBLIC_FORMBRICKS_API_HOST,
    NEXT_PUBLIC_FORMBRICKS_ENVIRONMENT_ID: process.env.NEXT_PUBLIC_FORMBRICKS_ENVIRONMENT_ID,
    NEXT_PUBLIC_FORMBRICKS_ONBOARDING_SURVEY_ID: process.env.NEXT_PUBLIC_FORMBRICKS_ONBOARDING_SURVEY_ID,
    NEXT_PUBLIC_POSTHOG_API_HOST: process.env.NEXT_PUBLIC_POSTHOG_API_HOST,
    NEXT_PUBLIC_POSTHOG_API_KEY: process.env.NEXT_PUBLIC_POSTHOG_API_KEY,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    OPENTELEMETRY_LISTENER_URL: process.env.OPENTELEMETRY_LISTENER_URL,
    NOTION_OAUTH_CLIENT_ID: process.env.NOTION_OAUTH_CLIENT_ID,
    NOTION_OAUTH_CLIENT_SECRET: process.env.NOTION_OAUTH_CLIENT_SECRET,
    OIDC_CLIENT_ID: process.env.OIDC_CLIENT_ID,
    OIDC_CLIENT_SECRET: process.env.OIDC_CLIENT_SECRET,
    OIDC_DISPLAY_NAME: process.env.OIDC_DISPLAY_NAME,
    OIDC_ISSUER: process.env.OIDC_ISSUER,
    OIDC_SIGNING_ALGORITHM: process.env.OIDC_SIGNING_ALGORITHM,
    REDIS_URL: process.env.REDIS_URL,
    REDIS_HTTP_URL: process.env.REDIS_HTTP_URL,
    PASSWORD_RESET_DISABLED: process.env.PASSWORD_RESET_DISABLED,
    PRIVACY_URL: process.env.PRIVACY_URL,
    RATE_LIMITING_DISABLED: process.env.RATE_LIMITING_DISABLED,
    S3_ACCESS_KEY: process.env.S3_ACCESS_KEY,
    S3_BUCKET_NAME: process.env.S3_BUCKET_NAME,
    S3_REGION: process.env.S3_REGION,
    S3_SECRET_KEY: process.env.S3_SECRET_KEY,
    S3_ENDPOINT_URL: process.env.S3_ENDPOINT_URL,
    S3_FORCE_PATH_STYLE: process.env.S3_FORCE_PATH_STYLE,
    SHORT_URL_BASE: process.env.SHORT_URL_BASE,
    SIGNUP_DISABLED: process.env.SIGNUP_DISABLED,
    SLACK_CLIENT_ID: process.env.SLACK_CLIENT_ID,
    SLACK_CLIENT_SECRET: process.env.SLACK_CLIENT_SECRET,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PASSWORD: process.env.SMTP_PASSWORD,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_SECURE_ENABLED: process.env.SMTP_SECURE_ENABLED,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_REJECT_UNAUTHORIZED_TLS: process.env.SMTP_REJECT_UNAUTHORIZED_TLS,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    TELEMETRY_DISABLED: process.env.TELEMETRY_DISABLED,
    TERMS_URL: process.env.TERMS_URL,
    UPLOADS_DIR: process.env.UPLOADS_DIR,
    VERCEL_URL: process.env.VERCEL_URL,
    WEBAPP_URL: process.env.WEBAPP_URL,
    UNSPLASH_ACCESS_KEY: process.env.UNSPLASH_ACCESS_KEY,
  },
});
