import type { TBannerData, TCreativeData, TFeedbackButtonData } from "./model";

/** Minimal creatives for the unit tests of this view. */
const common = {
  workspaceId: "clw0000000000000000000001",
  status: "inProgress" as const,
  displayStatus: "active" as const,
  displayStatusReason: null,
  defaultLanguage: "en-US",
  languages: [{ code: "en-US", default: true, enabled: true }],
  destination: null,
  distribution: { showOn: "pageView" as const, triggers: [], conditions: null, displayPercentage: null },
  schedule: { startAt: null, endAt: null },
  warnings: [],
  updatedAt: "2026-10-20T14:30:00.000Z",
};

export const makeFeedbackButton = (overrides: Partial<TFeedbackButtonData> = {}): TFeedbackButtonData => ({
  ...common,
  id: "clc0000000000000000000001",
  name: "Feedback tab",
  type: "feedbackButton",
  content: { label: { "en-US": "Feedback", "de-DE": "Rückmeldung" }, icon: "messageSquare" },
  styling: { position: { desktop: { edge: "right", offset: 50 }, phone: null } },
  ...overrides,
});

export const makeBanner = (overrides: Partial<TBannerData> = {}): TBannerData => ({
  ...common,
  id: "clc0000000000000000000002",
  name: "Banner",
  type: "banner",
  content: {
    message: { "en-US": [{ text: "Hello", bold: true }] },
    button: { label: { "en-US": "Go" } },
    dismissible: true,
    accessibleName: null,
  },
  styling: { position: { desktop: { placement: "top", layout: "inPage" }, phone: null } },
  ...overrides,
});

export const asStructured = (creative: TCreativeData) => ({ data: creative, requestId: "req_1" });
