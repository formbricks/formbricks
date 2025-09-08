// Client-safe constants that can be used in both server and client components
// These constants do not expose sensitive server-side information
import { TUserLocale } from "@formbricks/types/user";

// UI constants
export const DEFAULT_BRAND_COLOR = "#64748b";
export const FB_LOGO_URL =
  "https://s3.eu-central-1.amazonaws.com/listmonk-formbricks/Formbricks-Light-transparent.png";

// Pagination constants
export const ITEMS_PER_PAGE = 30;
export const SURVEYS_PER_PAGE = 12;
export const RESPONSES_PER_PAGE = 25;
export const TEXT_RESPONSES_PER_PAGE = 5;
export const MAX_RESPONSES_FOR_INSIGHT_GENERATION = 500;
export const MAX_OTHER_OPTION_LENGTH = 250;

// Message limits for integrations
export const SLACK_MESSAGE_LIMIT = 2995;
export const GOOGLE_SHEET_MESSAGE_LIMIT = 49995;
export const AIRTABLE_MESSAGE_LIMIT = 99995;
export const NOTION_RICH_TEXT_LIMIT = 1995;

// File size limits
export const MAX_SIZES = {
  standard: 1024 * 1024 * 10, // 10MB
  big: 1024 * 1024 * 1024, // 1GB
} as const;

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

// Localization constants
export const DEFAULT_LOCALE = "en-US";
export const AVAILABLE_LOCALES: TUserLocale[] = [
  "en-US",
  "de-DE",
  "pt-BR",
  "fr-FR",
  "zh-Hant-TW",
  "pt-PT",
  "ro-RO",
  "ja-JP",
];

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
  STARTUP_MAY25_MONTHLY = "STARTUP_MAY25_MONTHLY",
  STARTUP_MAY25_YEARLY = "STARTUP_MAY25_YEARLY",
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

// Maximum number of attribute classes allowed:
export const MAX_ATTRIBUTE_CLASSES_PER_ENVIRONMENT = 150;

// Stripe API version
export const STRIPE_API_VERSION = "2024-06-20";

// Unsplash allowed domains (for client-side validation)
export const UNSPLASH_ALLOWED_DOMAINS = ["api.unsplash.com"];
