export const RESPONSES_LIMIT_FREE = 100;
export const IS_FORMBRICKS_CLOUD = process.env.NEXT_PUBLIC_IS_FORMBRICKS_CLOUD === "1";
export const REVALIDATION_INTERVAL = 0; //TODO: find a good way to cache and revalidate data when it changes

// URLs
const HEROKU_URL = process.env.HEROKU_APP_NAME ? `https://${process.env.HEROKU_APP_NAME}.herokuapp.com` : "";
export const WEBAPP_URL =
  process.env.WEBAPP_URL || process.env.NEXT_PUBLIC_WEBAPP_URL || HEROKU_URL || "http://localhost:3000";

export const SURVEY_BASE_URL = process.env.NEXT_PUBLIC_SURVEY_BASE_URL
  ? process.env.NEXT_PUBLIC_SURVEY_BASE_URL + "/"
  : `${WEBAPP_URL}/s/`;

// Other
export const INTERNAL_SECRET = process.env.INTERNAL_SECRET || "";
export const CRON_SECRET = process.env.CRON_SECRET;
export const DEFAULT_BRAND_COLOR = "#64748b";
