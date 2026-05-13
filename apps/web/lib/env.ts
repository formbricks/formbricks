import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";
import { AI_PROVIDERS } from "@formbricks/types/ai";

const ZActiveAIProvider = z.enum(AI_PROVIDERS);
const ZAIConfigurationEnv = z.object({
  AI_PROVIDER: ZActiveAIProvider.optional(),
  AI_MODEL: z.string().optional(),
  AI_GCP_PROJECT: z.string().optional(),
  AI_GCP_LOCATION: z.string().optional(),
  AI_GCP_CREDENTIALS_JSON: z.string().optional(),
  AI_GCP_APPLICATION_CREDENTIALS: z.string().optional(),
  AI_AWS_REGION: z.string().optional(),
  AI_AWS_ACCESS_KEY_ID: z.string().optional(),
  AI_AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AI_AZURE_API_KEY: z.string().optional(),
  AI_AZURE_BASE_URL: z.url().optional(),
  AI_AZURE_RESOURCE_NAME: z.string().optional(),
});

type TAIConfigurationEnv = z.infer<typeof ZAIConfigurationEnv>;

const addEnvIssue = (ctx: z.RefinementCtx, path: keyof TAIConfigurationEnv, message: string): void => {
  ctx.addIssue({
    code: "custom",
    path: [path],
    message,
  });
};

const validateActiveAIModel = (values: TAIConfigurationEnv, ctx: z.RefinementCtx): void => {
  if (values.AI_PROVIDER && !values.AI_MODEL) {
    addEnvIssue(ctx, "AI_MODEL", "AI_MODEL is required when AI_PROVIDER is set");
  }
};

const validateAwsAIConfiguration = (values: TAIConfigurationEnv, ctx: z.RefinementCtx): void => {
  if (!values.AI_AWS_REGION) {
    addEnvIssue(ctx, "AI_AWS_REGION", "AI_AWS_REGION is required when AI_PROVIDER=aws");
  }

  if (!values.AI_AWS_ACCESS_KEY_ID) {
    addEnvIssue(ctx, "AI_AWS_ACCESS_KEY_ID", "AI_AWS_ACCESS_KEY_ID is required when AI_PROVIDER=aws");
  }

  if (!values.AI_AWS_SECRET_ACCESS_KEY) {
    addEnvIssue(ctx, "AI_AWS_SECRET_ACCESS_KEY", "AI_AWS_SECRET_ACCESS_KEY is required when AI_PROVIDER=aws");
  }
};

const validateGcpAIConfiguration = (values: TAIConfigurationEnv, ctx: z.RefinementCtx): void => {
  if (!values.AI_GCP_PROJECT) {
    addEnvIssue(ctx, "AI_GCP_PROJECT", "AI_GCP_PROJECT is required when AI_PROVIDER=gcp");
  }

  if (!values.AI_GCP_LOCATION) {
    addEnvIssue(ctx, "AI_GCP_LOCATION", "AI_GCP_LOCATION is required when AI_PROVIDER=gcp");
  }

  if (!values.AI_GCP_CREDENTIALS_JSON && !values.AI_GCP_APPLICATION_CREDENTIALS) {
    addEnvIssue(
      ctx,
      "AI_GCP_CREDENTIALS_JSON",
      "AI_GCP_CREDENTIALS_JSON or AI_GCP_APPLICATION_CREDENTIALS is required when AI_PROVIDER=gcp"
    );
  }

  if (values.AI_GCP_CREDENTIALS_JSON) {
    try {
      JSON.parse(values.AI_GCP_CREDENTIALS_JSON);
    } catch {
      addEnvIssue(ctx, "AI_GCP_CREDENTIALS_JSON", "AI_GCP_CREDENTIALS_JSON must be valid JSON");
    }
  }
};

const validateAzureAIConfiguration = (values: TAIConfigurationEnv, ctx: z.RefinementCtx): void => {
  if (!values.AI_AZURE_API_KEY) {
    addEnvIssue(ctx, "AI_AZURE_API_KEY", "AI_AZURE_API_KEY is required when AI_PROVIDER=azure");
  }

  if (!values.AI_AZURE_BASE_URL && !values.AI_AZURE_RESOURCE_NAME) {
    addEnvIssue(
      ctx,
      "AI_AZURE_BASE_URL",
      "AI_AZURE_BASE_URL or AI_AZURE_RESOURCE_NAME is required when AI_PROVIDER=azure"
    );
  }
};

const validateActiveAIProviderConfiguration = (values: TAIConfigurationEnv, ctx: z.RefinementCtx): void => {
  validateActiveAIModel(values, ctx);

  if (!values.AI_PROVIDER) {
    return;
  }

  const providerValidators: Record<
    z.infer<typeof ZActiveAIProvider>,
    (values: TAIConfigurationEnv, ctx: z.RefinementCtx) => void
  > = {
    aws: validateAwsAIConfiguration,
    gcp: validateGcpAIConfiguration,
    azure: validateAzureAIConfiguration,
  };

  providerValidators[values.AI_PROVIDER](values, ctx);
};

const parsedEnv = createEnv({
  /*
   * Serverside Environment variables, not available on the client.
   * Will throw if you access these variables on the client.
   */
  server: {
    AI_PROVIDER: ZActiveAIProvider.optional(),
    AI_MODEL: z.string().optional(),
    AIRTABLE_CLIENT_ID: z.string().optional(),
    AZUREAD_CLIENT_ID: z.string().optional(),
    AZUREAD_CLIENT_SECRET: z.string().optional(),
    AZUREAD_TENANT_ID: z.string().optional(),
    CRON_SECRET: z.string().optional(),
    BREVO_API_KEY: z.string().optional(),
    BREVO_LIST_ID: z.string().optional(),
    DATABASE_URL: z.url(),
    DISABLE_ACCOUNT_DELETION_SSO_REAUTH: z.enum(["1", "0"]).optional(),
    DANGEROUSLY_ALLOW_WEBHOOK_INTERNAL_URLS: z.enum(["1", "0"]).optional(),
    DEBUG: z.enum(["1", "0"]).optional(),
    DEBUG_SHOW_RESET_LINK: z.enum(["1", "0"]).optional(),
    AUTH_DEFAULT_TEAM_ID: z.string().optional(),
    AUTH_SKIP_INVITE_FOR_SSO: z.enum(["1", "0"]).optional(),
    E2E_TESTING: z.enum(["1", "0"]).optional(),
    EMAIL_AUTH_DISABLED: z.enum(["1", "0"]).optional(),
    EMAIL_VERIFICATION_DISABLED: z.enum(["1", "0"]).optional(),
    ENCRYPTION_KEY: z.string(),
    ENTERPRISE_LICENSE_KEY: z.string().optional(),
    ENVIRONMENT: z.enum(["production", "staging"]).prefault("production"),
    GITHUB_ID: z.string().optional(),
    GITHUB_SECRET: z.string().optional(),
    GOOGLE_ACCOUNT_DELETION_REAUTH_ENABLED: z.enum(["1", "0"]).optional(),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    AI_GCP_PROJECT: z.string().optional(),
    AI_GCP_LOCATION: z.string().optional(),
    AI_GCP_CREDENTIALS_JSON: z.string().optional(),
    AI_GCP_APPLICATION_CREDENTIALS: z.string().optional(),
    GOOGLE_SHEETS_CLIENT_ID: z.string().optional(),
    GOOGLE_SHEETS_CLIENT_SECRET: z.string().optional(),
    GOOGLE_SHEETS_REDIRECT_URL: z.string().optional(),
    AI_AWS_REGION: z.string().optional(),
    AI_AWS_ACCESS_KEY_ID: z.string().optional(),
    AI_AWS_SECRET_ACCESS_KEY: z.string().optional(),
    AI_AWS_SESSION_TOKEN: z.string().optional(),
    AI_AZURE_BASE_URL: z.url().optional(),
    AI_AZURE_API_KEY: z.string().optional(),
    AI_AZURE_API_VERSION: z.string().optional(),
    AI_AZURE_RESOURCE_NAME: z.string().optional(),
    HTTP_PROXY: z.url().optional(),
    HTTPS_PROXY: z.url().optional(),
    IMPRINT_URL: z
      .url()
      .optional()
      .or(z.string().refine((str) => str === "")),
    IMPRINT_ADDRESS: z.string().optional(),
    INVITE_DISABLED: z.enum(["1", "0"]).optional(),
    CHATWOOT_WEBSITE_TOKEN: z.string().optional(),
    CHATWOOT_BASE_URL: z.url().optional(),
    IS_FORMBRICKS_CLOUD: z.enum(["1", "0"]).optional(),
    POSTHOG_KEY: z.string().optional(),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error", "fatal"]).optional(),
    MAIL_FROM: z.email().optional(),
    NEXTAUTH_URL: z.url().optional(),
    NEXTAUTH_SECRET: z.string().optional(),
    MAIL_FROM_NAME: z.string().optional(),
    NOTION_OAUTH_CLIENT_ID: z.string().optional(),
    NOTION_OAUTH_CLIENT_SECRET: z.string().optional(),
    OIDC_CLIENT_ID: z.string().optional(),
    OIDC_CLIENT_SECRET: z.string().optional(),
    OIDC_DISPLAY_NAME: z.string().optional(),
    OIDC_ISSUER: z.string().optional(),
    OIDC_SIGNING_ALGORITHM: z.string().optional(),
    REDIS_URL:
      process.env.NODE_ENV === "test"
        ? z.string().optional()
        : z.url("REDIS_URL is required for caching, rate limiting, and audit logging"),
    PASSWORD_RESET_DISABLED: z.enum(["1", "0"]).optional(),
    PASSWORD_RESET_TOKEN_LIFETIME_MINUTES: z.coerce.number().int().min(5).max(120).optional().default(30),
    PRIVACY_URL: z
      .url()
      .optional()
      .or(z.string().refine((str) => str === "")),
    RATE_LIMITING_DISABLED: z.enum(["1", "0"]).optional(),
    TELEMETRY_DISABLED: z.enum(["1", "0"]).optional(),
    S3_ACCESS_KEY: z.string().optional(),
    S3_BUCKET_NAME: z.string().optional(),
    S3_REGION: z.string().optional(),
    S3_SECRET_KEY: z.string().optional(),
    S3_ENDPOINT_URL: z.string().optional(),
    S3_FORCE_PATH_STYLE: z.enum(["1", "0"]).optional(),
    SAML_DATABASE_URL: z.string().optional(),
    SENTRY_DSN: z.string().optional(),
    SLACK_CLIENT_ID: z.string().optional(),
    SLACK_CLIENT_SECRET: z.string().optional(),
    SMTP_HOST: z.string().min(1).optional(),
    SMTP_PORT: z.string().min(1).optional(),
    SMTP_SECURE_ENABLED: z.enum(["1", "0"]).optional(),
    SMTP_USER: z.string().min(1).optional(),
    SMTP_PASSWORD: z.string().min(1).optional(),
    SMTP_AUTHENTICATED: z.enum(["1", "0"]).optional(),
    SMTP_REJECT_UNAUTHORIZED_TLS: z.enum(["1", "0"]).optional(),
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    STRIPE_PUBLISHABLE_KEY: z.string().optional(),
    PUBLIC_URL: z
      .url()
      .refine(
        (url) => {
          try {
            const parsed = new URL(url);
            return parsed.host && parsed.host.length > 0;
          } catch {
            return false;
          }
        },
        {
          error: "PUBLIC_URL must be a valid URL with a proper host (e.g., https://example.com)",
        }
      )
      .optional(),
    TERMS_URL: z
      .url()
      .optional()
      .or(z.string().refine((str) => str === "")),
    TURNSTILE_SECRET_KEY: z.string().optional(),
    TURNSTILE_SITE_KEY: z.string().optional(),
    RECAPTCHA_SITE_KEY: z.string().optional(),
    RECAPTCHA_SECRET_KEY: z.string().optional(),
    WEBAPP_URL: z.url().optional(),
    UNSPLASH_ACCESS_KEY: z.string().optional(),

    NODE_ENV: z.enum(["development", "production", "test"]).optional(),
    PROMETHEUS_EXPORTER_PORT: z.string().optional(),
    PROMETHEUS_ENABLED: z.enum(["1", "0"]).optional(),
    USER_MANAGEMENT_MINIMUM_ROLE: z.enum(["owner", "manager", "disabled"]).optional(),
    AUDIT_LOG_ENABLED: z.enum(["1", "0"]).optional(),
    AUDIT_LOG_GET_USER_IP: z.enum(["1", "0"]).optional(),
    SESSION_MAX_AGE: z
      .string()
      .transform((val) => Number.parseInt(val, 10))
      .optional(),
    SENTRY_ENVIRONMENT: z.string().optional(),
  },

  /*
   * Due to how Next.js bundles environment variables on Edge and Client,
   * we need to manually destructure them to make sure all are included in bundle.
   *
   * 💡 You'll get type errors if not all variables from `server` & `client` are included here.
   */
  runtimeEnv: {
    AI_PROVIDER: process.env.AI_PROVIDER,
    AI_MODEL: process.env.AI_MODEL,
    AIRTABLE_CLIENT_ID: process.env.AIRTABLE_CLIENT_ID,
    AZUREAD_CLIENT_ID: process.env.AZUREAD_CLIENT_ID,
    AZUREAD_CLIENT_SECRET: process.env.AZUREAD_CLIENT_SECRET,
    AZUREAD_TENANT_ID: process.env.AZUREAD_TENANT_ID,
    BREVO_API_KEY: process.env.BREVO_API_KEY,
    BREVO_LIST_ID: process.env.BREVO_LIST_ID,
    CRON_SECRET: process.env.CRON_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    DISABLE_ACCOUNT_DELETION_SSO_REAUTH: process.env.DISABLE_ACCOUNT_DELETION_SSO_REAUTH,
    DANGEROUSLY_ALLOW_WEBHOOK_INTERNAL_URLS: process.env.DANGEROUSLY_ALLOW_WEBHOOK_INTERNAL_URLS,
    DEBUG: process.env.DEBUG,
    DEBUG_SHOW_RESET_LINK: process.env.DEBUG_SHOW_RESET_LINK,
    AUTH_DEFAULT_TEAM_ID: process.env.AUTH_SSO_DEFAULT_TEAM_ID,
    AUTH_SKIP_INVITE_FOR_SSO: process.env.AUTH_SKIP_INVITE_FOR_SSO,
    E2E_TESTING: process.env.E2E_TESTING,
    EMAIL_AUTH_DISABLED: process.env.EMAIL_AUTH_DISABLED,
    EMAIL_VERIFICATION_DISABLED: process.env.EMAIL_VERIFICATION_DISABLED,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
    ENTERPRISE_LICENSE_KEY: process.env.ENTERPRISE_LICENSE_KEY,
    ENVIRONMENT: process.env.ENVIRONMENT,
    GITHUB_ID: process.env.GITHUB_ID,
    GITHUB_SECRET: process.env.GITHUB_SECRET,
    GOOGLE_ACCOUNT_DELETION_REAUTH_ENABLED: process.env.GOOGLE_ACCOUNT_DELETION_REAUTH_ENABLED,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    AI_GCP_PROJECT: process.env.AI_GCP_PROJECT,
    AI_GCP_LOCATION: process.env.AI_GCP_LOCATION,
    AI_GCP_CREDENTIALS_JSON: process.env.AI_GCP_CREDENTIALS_JSON,
    AI_GCP_APPLICATION_CREDENTIALS: process.env.AI_GCP_APPLICATION_CREDENTIALS,
    GOOGLE_SHEETS_CLIENT_ID: process.env.GOOGLE_SHEETS_CLIENT_ID,
    GOOGLE_SHEETS_CLIENT_SECRET: process.env.GOOGLE_SHEETS_CLIENT_SECRET,
    GOOGLE_SHEETS_REDIRECT_URL: process.env.GOOGLE_SHEETS_REDIRECT_URL,
    AI_AWS_REGION: process.env.AI_AWS_REGION,
    AI_AWS_ACCESS_KEY_ID: process.env.AI_AWS_ACCESS_KEY_ID,
    AI_AWS_SECRET_ACCESS_KEY: process.env.AI_AWS_SECRET_ACCESS_KEY,
    AI_AWS_SESSION_TOKEN: process.env.AI_AWS_SESSION_TOKEN,
    AI_AZURE_BASE_URL: process.env.AI_AZURE_BASE_URL,
    AI_AZURE_API_KEY: process.env.AI_AZURE_API_KEY,
    AI_AZURE_API_VERSION: process.env.AI_AZURE_API_VERSION,
    AI_AZURE_RESOURCE_NAME: process.env.AI_AZURE_RESOURCE_NAME,
    HTTP_PROXY: process.env.HTTP_PROXY,
    HTTPS_PROXY: process.env.HTTPS_PROXY,
    IMPRINT_URL: process.env.IMPRINT_URL,
    IMPRINT_ADDRESS: process.env.IMPRINT_ADDRESS,
    INVITE_DISABLED: process.env.INVITE_DISABLED,
    CHATWOOT_WEBSITE_TOKEN: process.env.CHATWOOT_WEBSITE_TOKEN,
    CHATWOOT_BASE_URL: process.env.CHATWOOT_BASE_URL,
    IS_FORMBRICKS_CLOUD: process.env.IS_FORMBRICKS_CLOUD,
    POSTHOG_KEY: process.env.POSTHOG_KEY,
    LOG_LEVEL: process.env.LOG_LEVEL,
    MAIL_FROM: process.env.MAIL_FROM,
    MAIL_FROM_NAME: process.env.MAIL_FROM_NAME,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    SENTRY_DSN: process.env.SENTRY_DSN,
    NOTION_OAUTH_CLIENT_ID: process.env.NOTION_OAUTH_CLIENT_ID,
    NOTION_OAUTH_CLIENT_SECRET: process.env.NOTION_OAUTH_CLIENT_SECRET,
    OIDC_CLIENT_ID: process.env.OIDC_CLIENT_ID,
    OIDC_CLIENT_SECRET: process.env.OIDC_CLIENT_SECRET,
    OIDC_DISPLAY_NAME: process.env.OIDC_DISPLAY_NAME,
    OIDC_ISSUER: process.env.OIDC_ISSUER,
    OIDC_SIGNING_ALGORITHM: process.env.OIDC_SIGNING_ALGORITHM,
    REDIS_URL: process.env.REDIS_URL,
    PASSWORD_RESET_DISABLED: process.env.PASSWORD_RESET_DISABLED,
    PASSWORD_RESET_TOKEN_LIFETIME_MINUTES: process.env.PASSWORD_RESET_TOKEN_LIFETIME_MINUTES,
    PRIVACY_URL: process.env.PRIVACY_URL,
    RATE_LIMITING_DISABLED: process.env.RATE_LIMITING_DISABLED,
    TELEMETRY_DISABLED: process.env.TELEMETRY_DISABLED,
    S3_ACCESS_KEY: process.env.S3_ACCESS_KEY,
    S3_BUCKET_NAME: process.env.S3_BUCKET_NAME,
    S3_REGION: process.env.S3_REGION,
    S3_SECRET_KEY: process.env.S3_SECRET_KEY,
    S3_ENDPOINT_URL: process.env.S3_ENDPOINT_URL,
    S3_FORCE_PATH_STYLE: process.env.S3_FORCE_PATH_STYLE,
    SAML_DATABASE_URL: process.env.SAML_DATABASE_URL,
    SLACK_CLIENT_ID: process.env.SLACK_CLIENT_ID,
    SLACK_CLIENT_SECRET: process.env.SLACK_CLIENT_SECRET,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PASSWORD: process.env.SMTP_PASSWORD,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_SECURE_ENABLED: process.env.SMTP_SECURE_ENABLED,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_REJECT_UNAUTHORIZED_TLS: process.env.SMTP_REJECT_UNAUTHORIZED_TLS,
    SMTP_AUTHENTICATED: process.env.SMTP_AUTHENTICATED,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY,
    PUBLIC_URL: process.env.PUBLIC_URL,
    TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
    TURNSTILE_SITE_KEY: process.env.TURNSTILE_SITE_KEY,
    RECAPTCHA_SITE_KEY: process.env.RECAPTCHA_SITE_KEY,
    RECAPTCHA_SECRET_KEY: process.env.RECAPTCHA_SECRET_KEY,
    TERMS_URL: process.env.TERMS_URL,
    WEBAPP_URL: process.env.WEBAPP_URL,
    UNSPLASH_ACCESS_KEY: process.env.UNSPLASH_ACCESS_KEY,
    NODE_ENV: process.env.NODE_ENV,
    PROMETHEUS_ENABLED: process.env.PROMETHEUS_ENABLED,
    PROMETHEUS_EXPORTER_PORT: process.env.PROMETHEUS_EXPORTER_PORT,
    USER_MANAGEMENT_MINIMUM_ROLE: process.env.USER_MANAGEMENT_MINIMUM_ROLE,
    AUDIT_LOG_ENABLED: process.env.AUDIT_LOG_ENABLED,
    AUDIT_LOG_GET_USER_IP: process.env.AUDIT_LOG_GET_USER_IP,
    SESSION_MAX_AGE: process.env.SESSION_MAX_AGE,
    SENTRY_ENVIRONMENT: process.env.SENTRY_ENVIRONMENT,
  },
});

export const env = ZAIConfigurationEnv.superRefine(validateActiveAIProviderConfiguration)
  .transform(() => parsedEnv)
  .parse(parsedEnv);
