import "server-only";
import path from "path";

export const IS_FORMBRICKS_CLOUD = process.env.IS_FORMBRICKS_CLOUD === "1";
export const REVALIDATION_INTERVAL = 0; //TODO: find a good way to cache and revalidate data when it changes
export const SERVICES_REVALIDATION_INTERVAL = 60 * 30; // 30 minutes
export const MAU_LIMIT = IS_FORMBRICKS_CLOUD ? 9000 : 1000000;

// URLs
export const WEBAPP_URL =
  process.env.WEBAPP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : false) ||
  "http://localhost:3000";

export const SHORT_URL_BASE = process.env.SHORT_URL_BASE ? process.env.SHORT_URL_BASE : WEBAPP_URL;

// encryption keys
export const FORMBRICKS_ENCRYPTION_KEY = process.env.FORMBRICKS_ENCRYPTION_KEY || undefined;
export const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

// Other
export const INTERNAL_SECRET = process.env.INTERNAL_SECRET || "";
export const CRON_SECRET = process.env.CRON_SECRET;
export const DEFAULT_BRAND_COLOR = "#64748b";

export const PRIVACY_URL = process.env.PRIVACY_URL;
export const TERMS_URL = process.env.TERMS_URL;
export const IMPRINT_URL = process.env.IMPRINT_URL;

export const PASSWORD_RESET_DISABLED = process.env.PASSWORD_RESET_DISABLED === "1";
export const EMAIL_VERIFICATION_DISABLED = process.env.EMAIL_VERIFICATION_DISABLED === "1";
export const GOOGLE_OAUTH_ENABLED = process.env.GOOGLE_AUTH_ENABLED === "1";
export const GITHUB_OAUTH_ENABLED = process.env.GITHUB_AUTH_ENABLED === "1";
export const AZURE_OAUTH_ENABLED = process.env.AZUREAD_AUTH_ENABLED === "1";

export const GITHUB_ID = process.env.GITHUB_ID;
export const GITHUB_SECRET = process.env.GITHUB_SECRET;
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
export const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

export const SIGNUP_ENABLED = process.env.SIGNUP_DISABLED !== "1";
export const INVITE_DISABLED = process.env.INVITE_DISABLED === "1";

export const GOOGLE_SHEETS_CLIENT_ID = process.env.GOOGLE_SHEETS_CLIENT_ID;
export const GOOGLE_SHEETS_CLIENT_SECRET = process.env.GOOGLE_SHEETS_CLIENT_SECRET;
export const GOOGLE_SHEETS_REDIRECT_URL = process.env.GOOGLE_SHEETS_REDIRECT_URL;

export const NOTION_OAUTH_CLIENT_ID = process.env.NOTION_OAUTH_CLIENT_ID;
export const NOTION_OAUTH_CLIENT_SECRET = process.env.NOTION_OAUTH_CLIENT_SECRET;
export const NOTION_REDIRECT_URI = `${WEBAPP_URL}/api/v1/integrations/notion/callback`;
export const NOTION_AUTH_URL = `https://api.notion.com/v1/oauth/authorize?client_id=${process.env.NOTION_OAUTH_CLIENT_ID}&response_type=code&owner=user&redirect_uri=${NOTION_REDIRECT_URI}`;

export const AIR_TABLE_CLIENT_ID = process.env.AIR_TABLE_CLIENT_ID;

export const SMTP_HOST = process.env.SMTP_HOST;
export const SMTP_PORT = process.env.SMTP_PORT;
export const SMTP_SECURE_ENABLED = process.env.SMTP_SECURE_ENABLED === "1";
export const SMTP_USER = process.env.SMTP_USER;
export const SMTP_PASSWORD = process.env.SMTP_PASSWORD;
export const MAIL_FROM = process.env.MAIL_FROM;

export const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;
export const NEXTAUTH_URL = process.env.NEXTAUTH_URL;
export const ITEMS_PER_PAGE = 50;
export const RESPONSES_PER_PAGE = 10;
export const OPEN_TEXT_RESPONSES_PER_PAGE = 5;

// Storage constants
export const UPLOADS_DIR = path.resolve("./uploads");
export const MAX_SIZES = {
  public: 1024 * 1024 * 10, // 10MB
  free: 1024 * 1024 * 10, // 10MB
  pro: 1024 * 1024 * 1024, // 1GB
} as const;
export const IS_S3_CONFIGURED: boolean =
  process.env.S3_ACCESS_KEY &&
  process.env.S3_SECRET_KEY &&
  process.env.S3_REGION &&
  process.env.S3_BUCKET_NAME
    ? true
    : false;
export const LOCAL_UPLOAD_URL = {
  public: new URL(`${WEBAPP_URL}/api/v1/management/storage/local`).href,
  private: new URL(`${WEBAPP_URL}/api/v1/client/storage/local`).href,
} as const;

// Pricing
export const PRICING_USERTARGETING_FREE_MTU = 2500;
export const PRICING_APPSURVEYS_FREE_RESPONSES = 250;
