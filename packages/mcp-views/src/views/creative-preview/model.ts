import {
  DEFAULT_CREATIVE_STYLE,
  type TBannerPlacement,
  type TBannerView,
  type TCreativeIcon,
  type TCreativePosition,
  type TCreativeStyle,
  type TCreativeTextRun,
  type TCreativeView,
  type TFeedbackButtonPlacement,
  type TFeedbackButtonView,
} from "../../shared/creatives-renderer";
import { type ToolResult, getToolError } from "../../shared/tool-result";

/*
 * What the view reads from `show_creative`: the creative exactly as `get_creative` answers it
 * (`structuredContent.data`) and the extras the server resolves for the preview (`_meta.formbricks`).
 * Everything here is declared by hand and checked at runtime, because a tool result is untrusted data.
 */

export type TCreativeStatus = "draft" | "inProgress" | "paused" | "completed";
export type TCreativeDisplayStatus = "draft" | "scheduled" | "active" | "paused" | "closed" | "archived";
export type TCreativeDisplayStatusReason =
  | "surveyNotActive"
  | "scheduleEnded"
  | "destinationMissing"
  | "actionMissing"
  | null;

export interface TCreativeLanguage {
  code: string;
  default: boolean;
  enabled: boolean;
}

export type TCreativeDestinationData =
  | { type: "survey"; surveyId: string; surveyName: string; opensAs: "popup" | "newTab" }
  | { type: "link"; url: string; opensAs: "newTab" };

export interface TShowConditionData {
  id: string;
  leftOperand: { type: string; value: string; meta?: { key: string } };
  operator: string;
  rightOperand?: { type: string; value: string | number | string[] };
}

export interface TShowConditionGroupData {
  id: string;
  connector: "and" | "or";
  conditions: (TShowConditionData | TShowConditionGroupData)[];
}

export interface TCreativeDistributionData {
  showOn: "pageView" | "action";
  triggers: { actionClassId: string }[];
  conditions: TShowConditionGroupData | null;
  displayPercentage: number | null;
}

interface TCreativeDataBase {
  id: string;
  workspaceId: string;
  name: string;
  status: TCreativeStatus;
  displayStatus: TCreativeDisplayStatus;
  displayStatusReason: TCreativeDisplayStatusReason;
  defaultLanguage: string;
  languages: TCreativeLanguage[];
  destination: TCreativeDestinationData | null;
  distribution: TCreativeDistributionData;
  schedule: { startAt: string | null; endAt: string | null };
  warnings: { code: string; message: string }[];
  updatedAt: string;
}

export interface TFeedbackButtonData extends TCreativeDataBase {
  type: "feedbackButton";
  content: { label: Record<string, string>; icon: TCreativeIcon | null };
  styling: { position: TCreativePosition<TFeedbackButtonPlacement> };
}

export interface TBannerData extends TCreativeDataBase {
  type: "banner";
  content: {
    message: Record<string, TCreativeTextRun[]>;
    button: { label: Record<string, string> } | null;
    dismissible: boolean;
    accessibleName: Record<string, string> | null;
  };
  styling: { position: TCreativePosition<TBannerPlacement> };
}

export type TCreativeData = TFeedbackButtonData | TBannerData;

export interface TCreativePreviewData {
  creative: TCreativeData;
  /** The look the SDK would apply, as the server resolved it from the workspace Look & Feel. */
  style: TCreativeStyle;
  /** `false` when the server could not read the workspace styling and the preview uses neutral defaults. */
  styleIsExact: boolean;
  /** Names of the actions that show it, by id order of `distribution.triggers`; `null` when not looked up. */
  triggerNames: string[] | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const CREATIVE_TYPES: readonly string[] = ["feedbackButton", "banner"];
const DISPLAY_STATUSES: readonly string[] = ["draft", "scheduled", "active", "paused", "closed", "archived"];

/** Enough of the creative's shape to draw and describe it; anything else is treated as not a creative. */
export const isCreativeData = (value: unknown): value is TCreativeData =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.name === "string" &&
  typeof value.type === "string" &&
  CREATIVE_TYPES.includes(value.type) &&
  typeof value.displayStatus === "string" &&
  DISPLAY_STATUSES.includes(value.displayStatus) &&
  typeof value.defaultLanguage === "string" &&
  Array.isArray(value.languages) &&
  Array.isArray(value.warnings) &&
  isRecord(value.content) &&
  isRecord(value.styling) &&
  isRecord(value.styling.position) &&
  isRecord(value.distribution) &&
  Array.isArray(value.distribution.triggers) &&
  isRecord(value.schedule);

const isStyleElement = (value: unknown): boolean =>
  isRecord(value) && isRecord(value.light) && isRecord(value.dark) && isRecord(value.desktop);

/** A resolved style the renderer can apply. The element is required; the banner button only for a banner. */
export const isCreativeStyle = (value: unknown): value is TCreativeStyle =>
  isRecord(value) &&
  isStyleElement(value.element) &&
  typeof value.pageFont === "boolean" &&
  (value.button === null || isStyleElement(value.button));

const readTriggerNames = (value: unknown): string[] | null =>
  Array.isArray(value) && value.every((name) => typeof name === "string") ? value : null;

/** The creative and its preview extras from a `show_creative` result, or `undefined` when it is not one. */
export const readCreativePreview = (
  result: ToolResult | null | undefined
): TCreativePreviewData | undefined => {
  const data = isRecord(result?.structuredContent) ? result.structuredContent.data : undefined;
  if (!isCreativeData(data)) return undefined;

  const extra = isRecord(result?._meta) ? result._meta.formbricks : undefined;
  const meta = isRecord(extra) ? extra : {};
  const style = isCreativeStyle(meta.style) ? meta.style : null;

  return {
    creative: data,
    style: style ?? DEFAULT_CREATIVE_STYLE,
    styleIsExact: style !== null && meta.styleIsExact !== false,
    triggerNames: readTriggerNames(meta.triggerNames),
  };
};

/** Languages a visitor can get: the default first, then the enabled ones. */
export const getLanguageOptions = (creative: TCreativeData): TCreativeLanguage[] => {
  const options = creative.languages.filter((language) => language.default || language.enabled);
  return [
    ...options.filter((language) => language.default),
    ...options.filter((language) => !language.default),
  ];
};

/** A text in `code`, falling back to the default language when that translation is missing or empty. */
const pickText = (
  text: Record<string, string> | null | undefined,
  code: string,
  fallback: string
): string => {
  const own = text?.[code];
  return own?.trim() ? own : (text?.[fallback] ?? "");
};

const pickRuns = (
  message: Record<string, TCreativeTextRun[]>,
  code: string,
  fallback: string
): TCreativeTextRun[] => {
  const own = message[code] as TCreativeTextRun[] | undefined;
  return own?.some(({ text }) => text.trim()) ? own : (message[fallback] ?? []);
};

/**
 * The creative as the renderer takes it, with its texts in `language`. Unlike the SDK's `resolve`, this
 * never drops a creative: a draft, a paused one or one without a Destination still previews, and the
 * status panel says why a live page would not show it. A press opens nothing here, so the Destination is
 * only enough to satisfy the type.
 */
export const buildCreativeView = (
  creative: TCreativeData,
  style: TCreativeStyle,
  language: string
): TCreativeView => {
  const fallback = creative.defaultLanguage;
  const code = getLanguageOptions(creative).some((option) => option.code === language) ? language : fallback;
  const destination = ((): TFeedbackButtonView["destination"] => {
    const own = creative.destination;
    if (own?.type === "survey" && own.opensAs === "popup") {
      return { type: "survey", surveyId: own.surveyId, opensAs: "popup" };
    }
    return { type: "link", url: "" };
  })();

  if (creative.type === "feedbackButton") {
    return {
      id: creative.id,
      type: "feedbackButton",
      label: pickText(creative.content.label, code, fallback),
      icon: creative.content.icon,
      position: creative.styling.position,
      style,
      destination,
    };
  }

  const { message, button, dismissible, accessibleName } = creative.content;
  const banner: TBannerView = {
    id: creative.id,
    type: "banner",
    message: pickRuns(message, code, fallback),
    buttonLabel: button ? pickText(button.label, code, fallback) : null,
    dismissible,
    accessibleName: pickText(accessibleName, code, fallback) || null,
    position: creative.styling.position,
    style,
    destination: creative.destination ? destination : null,
  };
  return banner;
};

/** The message of a failed call: the `error.detail` the Formbricks tools answer with, else any text. */
export const readFailure = (result: ToolResult | null | undefined): string | undefined => {
  if (!result?.isError) return undefined;
  const error = isRecord(result.structuredContent) ? result.structuredContent.error : undefined;
  if (isRecord(error) && typeof error.detail === "string") return error.detail;
  return getToolError(result);
};
