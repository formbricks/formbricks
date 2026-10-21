import {
  type BannerContentZodType,
  type BannerStylingZodType,
  type CreativeTypeZodType,
  type CreativeWarningZodType,
  type FeedbackButtonContentZodType,
  type FeedbackButtonStylingZodType,
  zBannerContent,
  zBannerStyling,
  zFeedbackButtonContent,
  zFeedbackButtonStyling,
} from "@formbricks/api-v3-schemas";
import type { TShowConditions } from "@formbricks/types/show-conditions";
import type { TCreativeStatus } from "./display-status";

/**
 * The creative domain (ENG-3993): one shape for every type (ADR 0001), whose `content` and `styling`
 * are validated per type by the schemas generated from the v3 spec. The stored JSON is the API JSON, so
 * the per-type schemas below are the only definition of either.
 */

export type TCreativeType = CreativeTypeZodType;
export type TFeedbackButtonContent = FeedbackButtonContentZodType;
export type TBannerContent = BannerContentZodType;
export type TFeedbackButtonStyling = FeedbackButtonStylingZodType;
export type TBannerStyling = BannerStylingZodType;
export type TCreativeWarning = CreativeWarningZodType;

/** `type` together with the two groups it decides, so a content can never pair with the wrong type. */
export type TCreativeTypedGroups =
  | { type: "feedbackButton"; content: TFeedbackButtonContent; styling: TFeedbackButtonStyling }
  | { type: "banner"; content: TBannerContent; styling: TBannerStyling };

/** The per-type `content` and `styling` schemas: what a stored row and every write are parsed with. */
export const CREATIVE_TYPE_SCHEMAS = {
  feedbackButton: { content: zFeedbackButtonContent, styling: zFeedbackButtonStyling },
  banner: { content: zBannerContent, styling: zBannerStyling },
} as const;

/** The theme's colours, each `{ light, dark? }` like the survey styling's, or `null` for the workspace's. */
export const CREATIVE_THEME_COLOR_KEYS = ["backgroundColor", "textColor", "borderColor"] as const;
export type TCreativeColorKey = (typeof CREATIVE_THEME_COLOR_KEYS)[number];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Stored styling in today's shape. Theme colours were plain `#rrggbb` strings before they had a dark
 * value; such a row (unreleased, dev data only) reads as `{ light }`. Every write stores the new shape,
 * so this only ever widens what a read accepts.
 */
const withPerAppearanceColors = (styling: unknown): unknown => {
  if (!isRecord(styling) || !isRecord(styling.theme)) return styling;
  const theme: Record<string, unknown> = { ...styling.theme };
  for (const key of CREATIVE_THEME_COLOR_KEYS) {
    const color = theme[key];
    if (typeof color === "string") theme[key] = { light: color };
  }
  return { ...styling, theme };
};

/** A stored row's JSON groups parsed with its type's schemas, or `null` when either no longer fits. */
export const parseCreativeTypedGroups = (row: {
  type: TCreativeTypedGroups["type"];
  content: unknown;
  styling: unknown;
}): TCreativeTypedGroups | null => {
  const storedStyling = withPerAppearanceColors(row.styling);
  if (row.type === "feedbackButton") {
    const content = CREATIVE_TYPE_SCHEMAS.feedbackButton.content.safeParse(row.content);
    const styling = CREATIVE_TYPE_SCHEMAS.feedbackButton.styling.safeParse(storedStyling);
    return content.success && styling.success
      ? { type: "feedbackButton", content: content.data, styling: styling.data }
      : null;
  }
  const content = CREATIVE_TYPE_SCHEMAS.banner.content.safeParse(row.content);
  const styling = CREATIVE_TYPE_SCHEMAS.banner.styling.safeParse(storedStyling);
  return content.success && styling.success
    ? { type: "banner", content: content.data, styling: styling.data }
    : null;
};

/** What a creative opens. A survey's eligibility is checked against the database when it is linked. */
export type TCreativeDestinationRef =
  | { type: "survey"; surveyId: string }
  | { type: "link"; url: string }
  | null;

export type TCreativeDistribution = {
  showOn: "pageView" | "action";
  triggers: { actionClassId: string }[];
  /** Show when, already pruned by `ZShowConditions`; `null` always shows. */
  conditions: TShowConditions;
  /** Share of visitors in percent; `null` shows it to everyone. */
  displayPercentage: number | null;
};

export type TCreativeSchedule = { startAt: Date | null; endAt: Date | null };

/** A non-default language the texts are written in. The default one lives in `defaultLanguage`. */
export type TCreativeLanguageRef = { code: string; enabled: boolean };

/** Everything a write sets: the state a create builds and a patch replaces group by group. */
export type TCreativeState = TCreativeTypedGroups & {
  name: string;
  status: TCreativeStatus;
  publishedAt: Date | null;
  archivedAt: Date | null;
  defaultLanguage: string;
  languages: TCreativeLanguageRef[];
  destination: TCreativeDestinationRef;
  distribution: TCreativeDistribution;
  schedule: TCreativeSchedule;
};

const NO_THEME_OVERRIDES = {
  customStyles: false,
  backgroundColor: null,
  textColor: null,
  borderColor: null,
  fontWeight: null,
  fontSize: { desktop: null, phone: null },
  paddingX: { desktop: null, phone: null },
  paddingY: { desktop: null, phone: null },
} as const;

/** Styling a create starts from when it sends none: the workspace Look & Feel, default positions. */
export const DEFAULT_CREATIVE_STYLING = {
  feedbackButton: {
    position: { desktop: { edge: "right", offset: 50 }, phone: null },
    theme: { ...NO_THEME_OVERRIDES, borderRadius: null },
  } satisfies TFeedbackButtonStyling,
  banner: {
    position: { desktop: { placement: "top", layout: "inPage" }, phone: null },
    theme: NO_THEME_OVERRIDES,
  } satisfies TBannerStyling,
};

export const DEFAULT_CREATIVE_DISTRIBUTION: TCreativeDistribution = {
  showOn: "pageView",
  triggers: [],
  conditions: null,
  displayPercentage: null,
};

export { type TCreativeShowConditions, toCreativeShowConditions } from "./creative-show-conditions";

/** A feedback button always opens something; a banner only when it has a button. */
export const needsDestination = (groups: TCreativeTypedGroups): boolean =>
  groups.type === "feedbackButton" || groups.content.button !== null;

/** Why a linked survey can't be a Destination (ENG-3868, T6), or `null` when it can. */
export type TDestinationSurveyIssue = "notFound" | "restricted" | "singleUse" | "pin";

export const DESTINATION_SURVEY_ISSUE_REASONS: Record<TDestinationSurveyIssue, string> = {
  notFound: "No survey with this id exists in the creative's workspace.",
  restricted:
    "Restricted surveys can't be a Destination: a creative is visible to the whole workspace. Choose a survey visible to the whole workspace, or a link.",
  singleUse: "Single-use link surveys can't be a Destination: every click needs its own working link.",
  pin: "PIN-protected surveys can't be a Destination.",
};

const WARNING_MESSAGES: Record<TCreativeWarning["code"], string> = {
  destinationMissing: "It needs a Destination: choose the survey or link it opens.",
  destinationNotAllowed: "Its survey can no longer be a Destination. Choose another survey or a link.",
  actionMissing: "It shows when an action fires but has no action, so it never shows.",
};

/** What needs attention on a creative, in a stable order. `destinationIssue` is its linked survey's. */
export const getCreativeWarnings = (
  state: Pick<TCreativeState, "destination" | "distribution"> & TCreativeTypedGroups,
  destinationIssue: TDestinationSurveyIssue | null
): TCreativeWarning[] => {
  const codes: TCreativeWarning["code"][] = [];
  if (needsDestination(state) && state.destination === null) codes.push("destinationMissing");
  if (state.destination?.type === "survey" && destinationIssue) codes.push("destinationNotAllowed");
  if (state.distribution.showOn === "action" && state.distribution.triggers.length === 0) {
    codes.push("actionMissing");
  }
  return codes.map((code) => ({ code, message: WARNING_MESSAGES[code] }));
};
