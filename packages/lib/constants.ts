export const RESPONSES_LIMIT_FREE = 100;
export const IS_FORMBRICKS_CLOUD = process.env.IS_FORMBRICKS_CLOUD === "1";
export const REVALIDATION_INTERVAL = 0; //TODO: find a good way to cache and revalidate data when it changes

// URLs
export const WEBAPP_URL = process.env.WEBAPP_URL || process.env.VERCEL_URL || "http://localhost:3000";

export const SURVEY_BASE_URL = process.env.NEXT_PUBLIC_SURVEY_BASE_URL
  ? process.env.NEXT_PUBLIC_SURVEY_BASE_URL + "/"
  : `${WEBAPP_URL}/s/`;

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

export const SIGNUP_ENABLED = process.env.SIGNUP_DISABLED !== "1";
export const INVITE_DISABLED = process.env.INVITE_DISABLED === "1";
