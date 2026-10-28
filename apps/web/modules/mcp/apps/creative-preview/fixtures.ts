import type { TCreativeResource } from "./preview";

/** Valid cuid2 ids and one creative of each type, for this folder's tests. */
export const workspaceId = "clw01234567890123456789012";
export const otherWorkspaceId = "clw99999999999999999999999";
export const creativeId = "clcr1234567890123456789012";
export const surveyId = "clsv1234567890123456789012";
export const actionIds = ["cla01234567890123456789012", "cla11234567890123456789012"] as const;

const NOW = "2026-10-20T14:30:00.000Z";

const base = {
  id: creativeId,
  workspaceId,
  status: "inProgress" as const,
  displayStatus: "active" as const,
  displayStatusReason: null,
  createdAt: NOW,
  updatedAt: NOW,
  publishedAt: NOW,
  archivedAt: null,
  creator: { name: "Dana" },
  defaultLanguage: "en-US",
  languages: [{ code: "en-US", default: true, enabled: true }],
  destination: {
    type: "survey" as const,
    surveyId,
    surveyName: "Pricing feedback",
    opensAs: "popup" as const,
  },
  distribution: {
    showOn: "pageView" as const,
    triggers: [],
    conditions: null,
    displayPercentage: null,
  },
  schedule: { startAt: null, endAt: null },
  warnings: [],
};

const theme = {
  customStyles: false,
  backgroundColor: null,
  textColor: null,
  borderColor: null,
  fontWeight: null,
  fontSize: { desktop: null, phone: null },
  paddingX: { desktop: null, phone: null },
  paddingY: { desktop: null, phone: null },
} as const;

export const makeFeedbackButton = (
  overrides: Partial<Extract<TCreativeResource, { type: "feedbackButton" }>> = {}
): Extract<TCreativeResource, { type: "feedbackButton" }> => ({
  ...base,
  name: "Pricing tab",
  type: "feedbackButton",
  content: { label: { "en-US": "Feedback" }, icon: null },
  styling: {
    position: { desktop: { edge: "right", offset: 50 }, phone: null },
    theme: { ...theme, borderRadius: null },
  },
  ...overrides,
});

export const makeBanner = (
  overrides: Partial<Extract<TCreativeResource, { type: "banner" }>> = {}
): Extract<TCreativeResource, { type: "banner" }> => ({
  ...base,
  name: "Autumn banner",
  type: "banner",
  content: {
    message: { "en-US": [{ text: "Everything is 20% off" }] },
    button: { label: { "en-US": "Claim" } },
    dismissible: true,
    accessibleName: null,
  },
  styling: { position: { desktop: { placement: "top", layout: "inPage" }, phone: null }, theme },
  ...overrides,
});
