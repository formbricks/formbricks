import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /*
   * Serverside Environment variables, not available on the client.
   * Will throw if you access these variables on the client.
   */
  server: {
    WEBAPP_URL: z.string().url().optional(),
    DATABASE_URL: z.string().url(),
    PRISMA_GENERATE_DATAPROXY: z.enum(["true", ""]).optional(),
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
    INVITE_DISABLED: z.enum(["1", "0"]).optional(),
    IS_FORMBRICKS_CLOUD: z.enum(["1", "0"]).optional(),
    VERCEL_URL: z.string().optional(),
    SURVEY_BASE_URL: z.string().optional(),
    GOOGLE_SHEETS_CLIENT_ID: z.string().optional(),
    GOOGLE_SHEETS_CLIENT_SECRET: z.string().optional(),
    GOOGLE_SHEETS_REDIRECT_URL: z.string().optional(),
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
    FORMBRICKS_ENCRYPTION_KEY: z.string().length(24).or(z.string().length(0)).optional(),
  },
  /*
   * Due to how Next.js bundles environment variables on Edge and Client,
   * we need to manually destructure them to make sure all are included in bundle.
   *
   * 💡 You'll get type errors if not all variables from `server` & `client` are included here.
   */
  runtimeEnv: {
    WEBAPP_URL: process.env.WEBAPP_URL,
    DATABASE_URL: process.env.DATABASE_URL,
    PRISMA_GENERATE_DATAPROXY: process.env.PRISMA_GENERATE_DATAPROXY,
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
    NEXT_PUBLIC_FORMBRICKS_API_HOST: process.env.NEXT_PUBLIC_FORMBRICKS_API_HOST,
    NEXT_PUBLIC_FORMBRICKS_ENVIRONMENT_ID: process.env.NEXT_PUBLIC_FORMBRICKS_ENVIRONMENT_ID,
    NEXT_PUBLIC_FORMBRICKS_ONBOARDING_SURVEY_ID: process.env.NEXT_PUBLIC_FORMBRICKS_ONBOARDING_SURVEY_ID,
    IS_FORMBRICKS_CLOUD: process.env.IS_FORMBRICKS_CLOUD,
    NEXT_PUBLIC_POSTHOG_API_KEY: process.env.NEXT_PUBLIC_POSTHOG_API_KEY,
    NEXT_PUBLIC_POSTHOG_API_HOST: process.env.NEXT_PUBLIC_POSTHOG_API_HOST,
    FORMBRICKS_ENCRYPTION_KEY: process.env.FORMBRICKS_ENCRYPTION_KEY,
    VERCEL_URL: process.env.VERCEL_URL,
    SURVEY_BASE_URL: process.env.SURVEY_BASE_URL,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  },
});
