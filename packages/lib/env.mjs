import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /*
   * Serverside Environment variables, not available on the client.
   * Will throw if you access these variables on the client.
   */
  server: {
    CUSTOMER_IO_API_KEY: z.string().optional(),
    CUSTOMER_IO_SITE_ID: z.string().optional(),
    NEXT_PUBLIC_POSTHOG_API_HOST: z.string().optional(),
    WEBAPP_URL: z.string().url().optional(),
    DATABASE_URL: z.string().url(),
    ENCRYPTION_KEY: z.string().length(64).or(z.string().length(32)),
    FORMBRICKS_ENCRYPTION_KEY: z.string().length(24).or(z.string().length(0)).optional(),
    NEXTAUTH_SECRET: z.string().min(1),
    NEXTAUTH_URL: z.string().url().optional(),
    MAIL_FROM: z.string().email().optional(),
    SMTP_HOST: z.string().min(1).optional(),
    SMTP_PORT: z.string().min(1).optional(),
    SMTP_USER: z.string().min(1).optional(),
    SMTP_PASSWORD: z.string().min(1).optional(),
    SMTP_SECURE_ENABLED: z.enum(["1", "0"]).optional(),
    GITHUB_ID: z.string().optional(),
    GITHUB_SECRET: z.string().optional(),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    CRON_SECRET: z.string().optional(),
    EMAIL_VERIFICATION_DISABLED: z.enum(["1", "0"]).optional(),
    PASSWORD_RESET_DISABLED: z.enum(["1", "0"]).optional(),
    SIGNUP_DISABLED: z.enum(["1", "0"]).optional(),
    PRIVACY_URL: z
      .string()
      .url()
      .optional()
      .or(z.string().refine((str) => str === "")),
    TERMS_URL: z
      .string()
      .url()
      .optional()
      .or(z.string().refine((str) => str === "")),
    IMPRINT_URL: z
      .string()
      .url()
      .optional()
      .or(z.string().refine((str) => str === "")),
    GITHUB_AUTH_ENABLED: z.enum(["1", "0"]).optional(),
    GOOGLE_AUTH_ENABLED: z.enum(["1", "0"]).optional(),
    AZUREAD_AUTH_ENABLED: z.enum(["1", "0"]).optional(),
    INVITE_DISABLED: z.enum(["1", "0"]).optional(),
    IS_FORMBRICKS_CLOUD: z.enum(["1", "0"]).optional(),
    VERCEL_URL: z.string().optional(),
    SHORT_URL_BASE: z.string().url().optional().or(z.string().length(0)),
    GOOGLE_SHEETS_CLIENT_ID: z.string().optional(),
    GOOGLE_SHEETS_CLIENT_SECRET: z.string().optional(),
    GOOGLE_SHEETS_REDIRECT_URL: z.string().optional(),
    AIRTABLE_CLIENT_ID: z.string().optional(),
    AWS_ACCESS_KEY: z.string().optional(),
    AWS_SECRET_KEY: z.string().optional(),
    S3_ACCESS_KEY: z.string().optional(),
    S3_SECRET_KEY: z.string().optional(),
    S3_REGION: z.string().optional(),
    S3_BUCKET_NAME: z.string().optional(),
    NOTION_OAUTH_CLIENT_ID: z.string().optional(),
    NOTION_OAUTH_CLIENT_SECRET: z.string().optional(),
    AZUREAD_CLIENT_SECRET: z.string().optional(),
    AZUREAD_TENANT_ID: z.string().optional(),
    AZUREAD_CLIENT_ID: z.string().optional(),
    DEFAULT_TEAM_ID: z.string().optional(),
    DEFAULT_TEAM_ROLE: z.enum(["owner", "admin", "editor", "developer", "viewer"]).optional(),
    ONBOARDING_DISABLED: z.string().optional(),
    ENTERPRISE_LICENSE_KEY: z.string().optional(),
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
    CUSTOMER_IO_API_KEY: process.env.CUSTOMER_IO_API_KEY,
    CUSTOMER_IO_SITE_ID: process.env.CUSTOMER_IO_SITE_ID,
    WEBAPP_URL: process.env.WEBAPP_URL,
    DATABASE_URL: process.env.DATABASE_URL,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    MAIL_FROM: process.env.MAIL_FROM,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASSWORD: process.env.SMTP_PASSWORD,
    SMTP_SECURE_ENABLED: process.env.SMTP_SECURE_ENABLED,
    GITHUB_ID: process.env.GITHUB_ID,
    GITHUB_SECRET: process.env.GITHUB_SECRET,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    CRON_SECRET: process.env.CRON_SECRET,
    EMAIL_VERIFICATION_DISABLED: process.env.EMAIL_VERIFICATION_DISABLED,
    PASSWORD_RESET_DISABLED: process.env.PASSWORD_RESET_DISABLED,
    SIGNUP_DISABLED: process.env.SIGNUP_DISABLED,
    INVITE_DISABLED: process.env.INVITE_DISABLED,
    PRIVACY_URL: process.env.PRIVACY_URL,
    TERMS_URL: process.env.TERMS_URL,
    IMPRINT_URL: process.env.IMPRINT_URL,
    GITHUB_AUTH_ENABLED: process.env.GITHUB_AUTH_ENABLED,
    GOOGLE_AUTH_ENABLED: process.env.GOOGLE_AUTH_ENABLED,
    GOOGLE_SHEETS_CLIENT_ID: process.env.GOOGLE_SHEETS_CLIENT_ID,
    GOOGLE_SHEETS_CLIENT_SECRET: process.env.GOOGLE_SHEETS_CLIENT_SECRET,
    GOOGLE_SHEETS_REDIRECT_URL: process.env.GOOGLE_SHEETS_REDIRECT_URL,
    S3_ACCESS_KEY: process.env.S3_ACCESS_KEY,
    S3_SECRET_KEY: process.env.S3_SECRET_KEY,
    S3_REGION: process.env.S3_REGION,
    S3_BUCKET_NAME: process.env.S3_BUCKET_NAME,
    NOTION_OAUTH_CLIENT_ID: process.env.NOTION_OAUTH_CLIENT_ID,
    NOTION_OAUTH_CLIENT_SECRET: process.env.NOTION_OAUTH_CLIENT_SECRET,
    NEXT_PUBLIC_FORMBRICKS_API_HOST: process.env.NEXT_PUBLIC_FORMBRICKS_API_HOST,
    NEXT_PUBLIC_FORMBRICKS_ENVIRONMENT_ID: process.env.NEXT_PUBLIC_FORMBRICKS_ENVIRONMENT_ID,
    NEXT_PUBLIC_FORMBRICKS_ONBOARDING_SURVEY_ID: process.env.NEXT_PUBLIC_FORMBRICKS_ONBOARDING_SURVEY_ID,
    IS_FORMBRICKS_CLOUD: process.env.IS_FORMBRICKS_CLOUD,
    NEXT_PUBLIC_POSTHOG_API_KEY: process.env.NEXT_PUBLIC_POSTHOG_API_KEY,
    NEXT_PUBLIC_POSTHOG_API_HOST: process.env.NEXT_PUBLIC_POSTHOG_API_HOST,
    FORMBRICKS_ENCRYPTION_KEY: process.env.FORMBRICKS_ENCRYPTION_KEY,
    VERCEL_URL: process.env.VERCEL_URL,
    SHORT_URL_BASE: process.env.SHORT_URL_BASE,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    AZUREAD_AUTH_ENABLED: process.env.AZUREAD_AUTH_ENABLED,
    AZUREAD_CLIENT_ID: process.env.AZUREAD_CLIENT_ID,
    AZUREAD_CLIENT_SECRET: process.env.AZUREAD_CLIENT_SECRET,
    AZUREAD_TENANT_ID: process.env.AZUREAD_TENANT_ID,
    AIRTABLE_CLIENT_ID: process.env.AIRTABLE_CLIENT_ID,
    DEFAULT_TEAM_ID: process.env.DEFAULT_TEAM_ID,
    DEFAULT_TEAM_ROLE: process.env.DEFAULT_TEAM_ROLE,
    ONBOARDING_DISABLED: process.env.ONBOARDING_DISABLED,
    ENTERPRISE_LICENSE_KEY: process.env.ENTERPRISE_LICENSE_KEY,
  },
});
