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
  // Feedback analytics (`POST /api/v3/feedback-queries` and its MCP tools, ADR 0016). The value stays
  // "dashboards": it is the Stripe feature lookup key and the licence-server flag name, both defined outside
  // this repository, so renaming the constant is the only rename that does not cut off a paying plan.
  FEEDBACK_ANALYTICS: "dashboards",
  WORKFLOWS: "workflows",
  DATA_RETENTION: "data-retention",
  BULK_INVITE: "bulk-invite",
  // ENG-2949: Custom CSS additions/edits on Cloud (Scale). Self-hosted needs no license for it.
  CUSTOM_CSS: "custom-css",
} as const;
