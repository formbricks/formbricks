import "server-only";
import { env } from "./env";

export const IS_FORMBRICKS_CLOUD = env.IS_FORMBRICKS_CLOUD === "1";

// URLs
export const WEBAPP_URL =
  env.WEBAPP_URL || (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : false) || "http://localhost:3000";

export const SHORT_URL_BASE = env.SHORT_URL_BASE ? env.SHORT_URL_BASE : WEBAPP_URL;

// encryption keys
export const FORMBRICKS_ENCRYPTION_KEY = env.FORMBRICKS_ENCRYPTION_KEY || undefined;
export const ENCRYPTION_KEY = env.ENCRYPTION_KEY;

// Other
export const CRON_SECRET = env.CRON_SECRET;
export const DEFAULT_BRAND_COLOR = "#64748b";

export const PRIVACY_URL = env.PRIVACY_URL;
export const TERMS_URL = env.TERMS_URL;
export const IMPRINT_URL = env.IMPRINT_URL;

export const PASSWORD_RESET_DISABLED = env.PASSWORD_RESET_DISABLED === "1";
export const EMAIL_VERIFICATION_DISABLED = env.EMAIL_VERIFICATION_DISABLED === "1";

export const GOOGLE_OAUTH_ENABLED = env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET ? true : false;
export const GITHUB_OAUTH_ENABLED = env.GITHUB_ID && env.GITHUB_SECRET ? true : false;
export const AZURE_OAUTH_ENABLED =
  env.AZUREAD_CLIENT_ID && env.AZUREAD_CLIENT_SECRET && env.AZUREAD_TENANT_ID ? true : false;
export const OIDC_OAUTH_ENABLED =
  env.OIDC_CLIENT_ID && env.OIDC_CLIENT_SECRET && env.OIDC_ISSUER ? true : false;

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

export const SIGNUP_ENABLED = env.SIGNUP_DISABLED !== "1";
export const EMAIL_AUTH_ENABLED = env.EMAIL_AUTH_DISABLED !== "1";
export const INVITE_DISABLED = env.INVITE_DISABLED === "1";

export const SLACK_CLIENT_SECRET = env.SLACK_CLIENT_SECRET;
export const SLACK_CLIENT_ID = env.SLACK_CLIENT_ID;
export const SLACK_AUTH_URL = `https://slack.com/oauth/v2/authorize?client_id=${env.SLACK_CLIENT_ID}&scope=channels:read,chat:write,chat:write.public,chat:write.customize`;

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
export const SMTP_REJECT_UNAUTHORIZED_TLS = env.SMTP_REJECT_UNAUTHORIZED_TLS !== "0";
export const MAIL_FROM = env.MAIL_FROM;

export const NEXTAUTH_SECRET = env.NEXTAUTH_SECRET;
export const ITEMS_PER_PAGE = 50;
export const SURVEYS_PER_PAGE = 12;
export const RESPONSES_PER_PAGE = 10;
export const TEXT_RESPONSES_PER_PAGE = 5;

export const DEFAULT_ORGANIZATION_ID = env.DEFAULT_ORGANIZATION_ID;
export const DEFAULT_ORGANIZATION_ROLE = env.DEFAULT_ORGANIZATION_ROLE;

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
  interval: 5 * 60, // 5 minutes
  allowedPerInterval: 200,
};
export const SHARE_RATE_LIMIT = {
  interval: 60 * 60, // 60 minutes
  allowedPerInterval: 30,
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

export const CUSTOMER_IO_SITE_ID = env.CUSTOMER_IO_SITE_ID;
export const CUSTOMER_IO_API_KEY = env.CUSTOMER_IO_API_KEY;
export const UNSPLASH_ACCESS_KEY = env.UNSPLASH_ACCESS_KEY;

export const STRIPE_API_VERSION = "2024-06-20";

// Maximum number of attribute classes allowed:
export const MAX_ATTRIBUTE_CLASSES_PER_ENVIRONMENT = 150 as const;

// Billing constants

export enum PRODUCT_FEATURE_KEYS {
  FREE = "free",
  STARTUP = "startup",
  SCALE = "scale",
  ENTERPRISE = "enterprise",
}

export enum STRIPE_PRODUCT_NAMES {
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
    RESPONSES: 500,
    MIU: 1000,
  },
  STARTUP: {
    RESPONSES: 2000,
    MIU: 2500,
  },
  SCALE: {
    RESPONSES: 5000,
    MIU: 20000,
  },
} as const;
