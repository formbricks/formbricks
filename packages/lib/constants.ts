import "server-only";
import { TUserLocale } from "@formbricks/types/user";
import { env } from "./env";

export const IS_FORMBRICKS_CLOUD = env.IS_FORMBRICKS_CLOUD === "1";

// URLs
export const WEBAPP_URL =
  env.WEBAPP_URL || (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : false) || "http://localhost:3000";

// encryption keys
export const FORMBRICKS_ENCRYPTION_KEY = env.FORMBRICKS_ENCRYPTION_KEY || undefined;
export const ENCRYPTION_KEY = env.ENCRYPTION_KEY;

// Other
export const CRON_SECRET = env.CRON_SECRET;
export const DEFAULT_BRAND_COLOR = "#64748b";
export const FB_LOGO_URL =
  "https://s3.eu-central-1.amazonaws.com/listmonk-formbricks/Formbricks-Light-transparent.png";

export const PRIVACY_URL = env.PRIVACY_URL;
export const TERMS_URL = env.TERMS_URL;
export const IMPRINT_URL = env.IMPRINT_URL;
export const IMPRINT_ADDRESS = env.IMPRINT_ADDRESS;

export const PASSWORD_RESET_DISABLED = env.PASSWORD_RESET_DISABLED === "1";
export const EMAIL_VERIFICATION_DISABLED = env.EMAIL_VERIFICATION_DISABLED === "1";

export const GOOGLE_OAUTH_ENABLED = env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET ? true : false;
export const GITHUB_OAUTH_ENABLED = env.GITHUB_ID && env.GITHUB_SECRET ? true : false;
export const AZURE_OAUTH_ENABLED =
  env.AZUREAD_CLIENT_ID && env.AZUREAD_CLIENT_SECRET && env.AZUREAD_TENANT_ID ? true : false;
export const OIDC_OAUTH_ENABLED =
  env.OIDC_CLIENT_ID && env.OIDC_CLIENT_SECRET && env.OIDC_ISSUER ? true : false;
export const SAML_OAUTH_ENABLED = env.SAML_DATABASE_URL ? true : false;
export const SAML_XML_DIR = "./saml-connection";

export const GITHUB_ID = env.GITHUB_ID;
export const GITHUB_SECRET = env.GITHUB_SECRET;
export const GOOGLE_CLIENT_ID = env.GOOGLE_CLIENT_ID;
export const GOOGLE_CLIENT_SECRET = env.GOOGLE_CLIENT_SECRET;

export const AZUREAD_CLIENT_ID = env.AZUREAD_CLIENT_ID;
export const AZUREAD_CLIENT_SECRET = env.AZUREAD_CLIENT_SECRET;
export const AZUREAD_TENANT_ID = env.AZUREAD_TENANT_ID;

export const OIDC_CLIENT_ID = env.OIDC_CLIENT_ID;
export const OIDC_CLIENT_SECRET = env.OIDC_CLIENT_SECRET;
export const OIDC_ISSUER = env.OIDC_ISSUER;
export const OIDC_DISPLAY_NAME = env.OIDC_DISPLAY_NAME;
export const OIDC_SIGNING_ALGORITHM = env.OIDC_SIGNING_ALGORITHM;

export const SAML_DATABASE_URL = env.SAML_DATABASE_URL;
export const SAML_TENANT = "formbricks.com";
export const SAML_PRODUCT = "formbricks";
export const SAML_AUDIENCE = "https://saml.formbricks.com";
export const SAML_PATH = "/api/auth/saml/callback";

export const SIGNUP_ENABLED = env.SIGNUP_DISABLED !== "1";
export const EMAIL_AUTH_ENABLED = env.EMAIL_AUTH_DISABLED !== "1";
export const INVITE_DISABLED = env.INVITE_DISABLED === "1";

export const SLACK_CLIENT_SECRET = env.SLACK_CLIENT_SECRET;
export const SLACK_CLIENT_ID = env.SLACK_CLIENT_ID;
export const SLACK_AUTH_URL = `https://slack.com/oauth/v2/authorize?client_id=${env.SLACK_CLIENT_ID}&scope=channels:read,chat:write,chat:write.public,chat:write.customize,groups:read`;

export const GOOGLE_SHEETS_CLIENT_ID = env.GOOGLE_SHEETS_CLIENT_ID;
export const GOOGLE_SHEETS_CLIENT_SECRET = env.GOOGLE_SHEETS_CLIENT_SECRET;
export const GOOGLE_SHEETS_REDIRECT_URL = env.GOOGLE_SHEETS_REDIRECT_URL;

export const NOTION_OAUTH_CLIENT_ID = env.NOTION_OAUTH_CLIENT_ID;
export const NOTION_OAUTH_CLIENT_SECRET = env.NOTION_OAUTH_CLIENT_SECRET;
export const NOTION_REDIRECT_URI = `${WEBAPP_URL}/api/v1/integrations/notion/callback`;
export const NOTION_AUTH_URL = `https://api.notion.com/v1/oauth/authorize?client_id=${env.NOTION_OAUTH_CLIENT_ID}&response_type=code&owner=user&redirect_uri=${NOTION_REDIRECT_URI}`;

export const AIRTABLE_CLIENT_ID = env.AIRTABLE_CLIENT_ID;

export const SMTP_HOST = env.SMTP_HOST;
export const SMTP_PORT = env.SMTP_PORT;
export const SMTP_SECURE_ENABLED = env.SMTP_SECURE_ENABLED === "1";
export const SMTP_USER = env.SMTP_USER;
export const SMTP_PASSWORD = env.SMTP_PASSWORD;
export const SMTP_AUTHENTICATED = env.SMTP_AUTHENTICATED !== "0";
export const SMTP_REJECT_UNAUTHORIZED_TLS = env.SMTP_REJECT_UNAUTHORIZED_TLS !== "0";
export const MAIL_FROM = env.MAIL_FROM;
export const MAIL_FROM_NAME = env.MAIL_FROM_NAME;

export const NEXTAUTH_SECRET = env.NEXTAUTH_SECRET;
export const ITEMS_PER_PAGE = 30;
export const SURVEYS_PER_PAGE = 12;
export const RESPONSES_PER_PAGE = 25;
export const TEXT_RESPONSES_PER_PAGE = 5;
export const INSIGHTS_PER_PAGE = 10;
export const DOCUMENTS_PER_PAGE = 10;
export const MAX_RESPONSES_FOR_INSIGHT_GENERATION = 500;

export const DEFAULT_ORGANIZATION_ID = env.DEFAULT_ORGANIZATION_ID;
export const DEFAULT_ORGANIZATION_ROLE = env.DEFAULT_ORGANIZATION_ROLE;

export const SLACK_MESSAGE_LIMIT = 2995;
export const GOOGLE_SHEET_MESSAGE_LIMIT = 49995;
export const AIRTABLE_MESSAGE_LIMIT = 99995;
export const NOTION_RICH_TEXT_LIMIT = 1995;

// Storage constants
export const S3_ACCESS_KEY = env.S3_ACCESS_KEY;
export const S3_SECRET_KEY = env.S3_SECRET_KEY;
export const S3_REGION = env.S3_REGION;
export const S3_ENDPOINT_URL = env.S3_ENDPOINT_URL;
export const S3_BUCKET_NAME = env.S3_BUCKET_NAME;
export const S3_FORCE_PATH_STYLE = env.S3_FORCE_PATH_STYLE === "1";
export const UPLOADS_DIR = env.UPLOADS_DIR || "./uploads";
export const MAX_SIZES = {
  standard: 1024 * 1024 * 10, // 10MB
  big: 1024 * 1024 * 1024, // 1GB
} as const;

// Function to check if the necessary S3 configuration is set up
export const isS3Configured = () => {
  // This function checks if the S3 bucket name environment variable is defined.
  // The AWS SDK automatically resolves credentials through a chain,
  // so we do not need to explicitly check for AWS credentials like access key, secret key, or region.
  return !!S3_BUCKET_NAME;
};

// Colors for Survey Bg
export const SURVEY_BG_COLORS = [
  "#FFFFFF",
  "#FFF2D8",
  "#EAD7BB",
  "#BCA37F",
  "#113946",
  "#04364A",
  "#176B87",
  "#64CCC5",
  "#DAFFFB",
  "#132043",
  "#1F4172",
  "#F1B4BB",
  "#FDF0F0",
  "#001524",
  "#445D48",
  "#D6CC99",
  "#FDE5D4",
  "#BEADFA",
  "#D0BFFF",
  "#DFCCFB",
  "#FFF8C9",
  "#FF8080",
  "#FFCF96",
  "#F6FDC3",
  "#CDFAD5",
];

// Rate Limiting
export const SIGNUP_RATE_LIMIT = {
  interval: 60 * 60, // 60 minutes
  allowedPerInterval: 30,
};
export const LOGIN_RATE_LIMIT = {
  interval: 15 * 60, // 15 minutes
  allowedPerInterval: 30,
};

export const CLIENT_SIDE_API_RATE_LIMIT = {
  interval: 60, // 1 minute
  allowedPerInterval: 100,
};
export const MANAGEMENT_API_RATE_LIMIT = {
  interval: 60, // 1 minute
  allowedPerInterval: 100,
};

export const SHARE_RATE_LIMIT = {
  interval: 60 * 60, // 60 minutes
  allowedPerInterval: 100,
};
export const FORGET_PASSWORD_RATE_LIMIT = {
  interval: 60 * 60, // 60 minutes
  allowedPerInterval: 5, // Limit to 5 requests per hour
};
export const RESET_PASSWORD_RATE_LIMIT = {
  interval: 60 * 60, // 60 minutes
  allowedPerInterval: 5, // Limit to 5 requests per hour
};
export const VERIFY_EMAIL_RATE_LIMIT = {
  interval: 60 * 60, // 60 minutes
  allowedPerInterval: 10, // Limit to 10 requests per hour
};
export const SYNC_USER_IDENTIFICATION_RATE_LIMIT = {
  interval: 60, // 1 minute
  allowedPerInterval: 5,
};

export const DEBUG = env.DEBUG === "1";
export const E2E_TESTING = env.E2E_TESTING === "1";

// Enterprise License constant
export const ENTERPRISE_LICENSE_KEY = env.ENTERPRISE_LICENSE_KEY;

export const REDIS_URL = env.REDIS_URL;
export const REDIS_HTTP_URL = env.REDIS_HTTP_URL;
export const RATE_LIMITING_DISABLED = env.RATE_LIMITING_DISABLED === "1";
export const UNKEY_ROOT_KEY = env.UNKEY_ROOT_KEY;

export const BREVO_API_KEY = env.BREVO_API_KEY;
export const BREVO_LIST_ID = env.BREVO_LIST_ID;

export const UNSPLASH_ACCESS_KEY = env.UNSPLASH_ACCESS_KEY;
export const UNSPLASH_ALLOWED_DOMAINS = ["api.unsplash.com"];

export const STRIPE_API_VERSION = "2024-06-20";

// Maximum number of attribute classes allowed:
export const MAX_ATTRIBUTE_CLASSES_PER_ENVIRONMENT = 150 as const;

export const DEFAULT_LOCALE = "en-US";
export const AVAILABLE_LOCALES: TUserLocale[] = ["en-US", "de-DE", "pt-BR", "fr-FR", "zh-Hant-TW", "pt-PT"];

// Billing constants

export enum PROJECT_FEATURE_KEYS {
  FREE = "free",
  STARTUP = "startup",
  SCALE = "scale",
  ENTERPRISE = "enterprise",
}

export enum STRIPE_PROJECT_NAMES {
  STARTUP = "Formbricks Startup",
  SCALE = "Formbricks Scale",
  ENTERPRISE = "Formbricks Enterprise",
}

export enum STRIPE_PRICE_LOOKUP_KEYS {
  STARTUP_MONTHLY = "formbricks_startup_monthly",
  STARTUP_YEARLY = "formbricks_startup_yearly",
  SCALE_MONTHLY = "formbricks_scale_monthly",
  SCALE_YEARLY = "formbricks_scale_yearly",
}

export const BILLING_LIMITS = {
  FREE: {
    PROJECTS: 3,
    RESPONSES: 1500,
    MIU: 2000,
  },
  STARTUP: {
    PROJECTS: 3,
    RESPONSES: 5000,
    MIU: 7500,
  },
  SCALE: {
    PROJECTS: 5,
    RESPONSES: 10000,
    MIU: 30000,
  },
} as const;

export const AI_AZURE_LLM_RESSOURCE_NAME = env.AI_AZURE_LLM_RESSOURCE_NAME;

export const IS_AI_CONFIGURED = Boolean(
  env.AI_AZURE_EMBEDDINGS_API_KEY &&
    env.AI_AZURE_EMBEDDINGS_DEPLOYMENT_ID &&
    env.AI_AZURE_EMBEDDINGS_RESSOURCE_NAME &&
    env.AI_AZURE_LLM_API_KEY &&
    env.AI_AZURE_LLM_DEPLOYMENT_ID &&
    env.AI_AZURE_LLM_RESSOURCE_NAME
);

export const INTERCOM_SECRET_KEY = env.INTERCOM_SECRET_KEY;
export const INTERCOM_APP_ID = env.INTERCOM_APP_ID;

export const IS_INTERCOM_CONFIGURED = Boolean(env.INTERCOM_APP_ID && INTERCOM_SECRET_KEY);

export const TURNSTILE_SECRET_KEY = env.TURNSTILE_SECRET_KEY;

export const IS_TURNSTILE_CONFIGURED = Boolean(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && TURNSTILE_SECRET_KEY);

export const IS_PRODUCTION = env.NODE_ENV === "production";

export const IS_DEVELOPMENT = env.NODE_ENV === "development";
