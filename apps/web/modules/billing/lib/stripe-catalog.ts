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
  FEEDBACK_DIRECTORIES: "feedback-directories",
  DASHBOARDS: "dashboards",
  WORKFLOWS: "workflows",
  BULK_INVITE: "bulk-invite",
  // ENG-2949: Custom CSS additions/edits on Cloud (Scale). Self-hosted needs no license for it.
  CUSTOM_CSS: "custom-css",
} as const;
