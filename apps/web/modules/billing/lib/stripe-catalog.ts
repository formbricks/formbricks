import "server-only";

export const CLOUD_STRIPE_FEATURE_LOOKUP_KEYS = {
  CUSTOM_REDIRECT_URL: "custom-redirect-url",
  CUSTOM_LINKS_IN_SURVEYS: "custom-links-in-surveys",
  FOLLOW_UPS: "follow-ups",
  HIDE_BRANDING: "hide-branding",
  QUOTA_MANAGEMENT: "quota-management",
  RBAC: "rbac",
  SPAM_PROTECTION: "spam-protection",
  CONTACTS: "contacts",
  AI_SMART_TOOLS: "ai-smart-tools",
  AI_DATA_ANALYSIS: "ai-data-analysis",
} as const;
