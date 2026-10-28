import type {
  TCreativeData,
  TCreativeDestinationData,
  TShowConditionData,
  TShowConditionGroupData,
} from "./model";

/*
 * The creative in words, for the status panel. Pure functions of the creative and a formatting context
 * (the host's locale and time zone), so they are tested without a browser. Dates and numbers go through
 * `Intl` with the host's locale and time zone; nothing here reads the browser's own.
 */

export interface TFormatContext {
  locale?: string;
  timeZone?: string;
}

export type TTone = "neutral" | "info" | "success" | "warning" | "danger";

const safeIntl = <T>(create: () => T, fallback: () => T): T => {
  try {
    return create();
  } catch {
    // An unsupported locale or time zone from the host must not break the panel.
    return fallback();
  }
};

export const formatInstant = (iso: string, { locale, timeZone }: TFormatContext = {}): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short", timeZone };
  return safeIntl(
    () => new Intl.DateTimeFormat(locale, options).format(date),
    () => new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date)
  );
};

export const formatNumber = (
  value: number,
  { locale }: TFormatContext = {},
  options: Intl.NumberFormatOptions = {}
): string =>
  safeIntl(
    () => new Intl.NumberFormat(locale, options).format(value),
    () => new Intl.NumberFormat("en-US", options).format(value)
  );

export interface TStatusDescription {
  label: string;
  tone: TTone;
  explanation: string;
}

const DISPLAY_STATUS_LABELS: Record<TCreativeData["displayStatus"], { label: string; tone: TTone }> = {
  draft: { label: "Draft", tone: "neutral" },
  scheduled: { label: "Scheduled", tone: "info" },
  active: { label: "Active", tone: "success" },
  paused: { label: "Paused", tone: "warning" },
  closed: { label: "Closed", tone: "neutral" },
  archived: { label: "Archived", tone: "neutral" },
};

const destinationSurveyName = (creative: TCreativeData): string =>
  creative.destination?.type === "survey" ? `"${creative.destination.surveyName}"` : "its survey";

/** The derived display status with the reason a visitor would not (or would) see it, in plain words. */
export const describeDisplayStatus = (
  creative: TCreativeData,
  format: TFormatContext = {}
): TStatusDescription => {
  const { label, tone } = DISPLAY_STATUS_LABELS[creative.displayStatus];
  const { displayStatus, displayStatusReason: reason, schedule } = creative;

  switch (displayStatus) {
    case "active":
      return { label, tone, explanation: "Showing on every page that matches its rules." };
    case "scheduled":
      return {
        label,
        tone,
        explanation: schedule.startAt
          ? `Published. Starts ${formatInstant(schedule.startAt, format)}.`
          : "Published, waiting for its start time.",
      };
    case "draft":
      return { label, tone, explanation: "Not published yet, so it shows nowhere." };
    case "archived":
      return {
        label,
        tone,
        explanation: "Set aside: it shows nowhere and is read-only. Restoring it makes it a draft again.",
      };
    case "closed":
      return {
        label,
        tone,
        explanation:
          reason === "scheduleEnded" && schedule.endAt
            ? `Its end time passed on ${formatInstant(schedule.endAt, format)}.`
            : "Closed by its author, so it shows nowhere.",
      };
    case "paused":
      return { label, tone, explanation: describePausedReason(creative) };
  }
};

const describePausedReason = (creative: TCreativeData): string => {
  switch (creative.displayStatusReason) {
    case "surveyNotActive":
      return `Paused with its survey: it comes back by itself when ${destinationSurveyName(creative)} is active again.`;
    case "destinationMissing":
      return "It needs a destination (a survey or a link) and has none, so sites never show it.";
    case "actionMissing":
      return "It shows when an action fires but has no action, so sites never show it.";
    default:
      return "Paused by its author. Resuming it shows it again.";
  }
};

/** When the creative appears: on every page view, or when one of its actions fires. */
export const describeShowOn = (
  { distribution }: Pick<TCreativeData, "distribution">,
  triggerNames: string[] | null
): string => {
  if (distribution.showOn === "pageView") return "On every page view";
  const count = distribution.triggers.length;
  if (count === 0) return "When an action fires, but none is set";
  if (triggerNames && triggerNames.length > 0) {
    const names = triggerNames.map((name) => `"${name}"`).join(", ");
    return count === 1 ? `When the action ${names} fires` : `When one of these actions fires: ${names}`;
  }
  return count === 1 ? "When its action fires" : `When one of its ${count} actions fires`;
};

export const describeShare = (percentage: number | null, format: TFormatContext = {}): string =>
  percentage === null
    ? "Every visitor"
    : `${formatNumber(percentage, format, { maximumFractionDigits: 2 })}% of visitors, decided once per visitor`;

export const describeSchedule = (
  { startAt, endAt }: TCreativeData["schedule"],
  format: TFormatContext = {}
): string => {
  if (startAt && endAt) return `${formatInstant(startAt, format)} to ${formatInstant(endAt, format)}`;
  if (startAt) return `From ${formatInstant(startAt, format)}, no end`;
  if (endAt) return `Until ${formatInstant(endAt, format)}`;
  return "No schedule: runs while published";
};

const OPERAND_LABELS: Record<string, string> = {
  currentUrl: "Current URL",
  pageReferrer: "Previous page",
  entryReferrer: "Referrer at the start of the visit",
  pagesViewed: "Pages viewed",
  uniquePagesViewed: "Different pages viewed",
  timeOnSite: "Seconds on site",
  visitedUrls: "Pages visited",
  deviceType: "Device type",
  browser: "Browser",
  screenWidth: "Window width in px",
};

const OPERATOR_LABELS: Record<string, string> = {
  equals: "is",
  doesNotEqual: "is not",
  contains: "contains",
  doesNotContain: "does not contain",
  startsWith: "starts with",
  endsWith: "ends with",
  containsAnyOf: "contains any of",
  containsNoneOf: "contains none of",
  pathIsAnyOf: "is one of the paths",
  pathIsNoneOf: "is none of the paths",
  isGreaterThan: "is greater than",
  isLessThan: "is less than",
  isGreaterThanOrEqual: "is at least",
  isLessThanOrEqual: "is at most",
  includes: "includes",
  doesNotInclude: "does not include",
  isSet: "is set",
  isNotSet: "is not set",
};

const MAX_LISTED_VALUES = 5;

const describeValue = (value: string | number | string[]): string => {
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return `"${value}"`;
  const shown = value.slice(0, MAX_LISTED_VALUES).map((entry) => `"${entry}"`);
  const more = value.length - shown.length;
  return more > 0 ? `${shown.join(", ")} and ${more} more` : shown.join(", ");
};

const describeOperand = ({ leftOperand }: TShowConditionData): string => {
  if (leftOperand.value === "queryParam") {
    return leftOperand.meta?.key ? `URL parameter "${leftOperand.meta.key}"` : "URL parameter";
  }
  return OPERAND_LABELS[leftOperand.value] ?? leftOperand.value;
};

export const describeCondition = (condition: TShowConditionData): string => {
  const operator = OPERATOR_LABELS[condition.operator] ?? condition.operator;
  const value = condition.rightOperand ? ` ${describeValue(condition.rightOperand.value)}` : "";
  return `${describeOperand(condition)} ${operator}${value}`;
};

const isGroup = (entry: TShowConditionData | TShowConditionGroupData): entry is TShowConditionGroupData =>
  "connector" in entry;

const describeEntry = (entry: TShowConditionData | TShowConditionGroupData): string => {
  if (!isGroup(entry)) return describeCondition(entry);
  const joiner = entry.connector === "and" ? " and " : " or ";
  return `(${entry.conditions.map(describeEntry).join(joiner)})`;
};

export interface TConditionsDescription {
  intro: string;
  items: string[];
}

/** Show when, as an intro plus one line per condition; `null` when it always passes. */
export const describeConditions = (group: TShowConditionGroupData | null): TConditionsDescription | null => {
  if (!group || group.conditions.length === 0) return null;
  const items = group.conditions.map(describeEntry);
  if (items.length === 1) return { intro: "Only when", items };
  return {
    intro: group.connector === "and" ? "Only when all of these hold" : "Only when any of these holds",
    items,
  };
};

export interface TDestinationDescription {
  summary: string;
  detail: string;
}

export const describeDestination = (
  destination: TCreativeDestinationData | null
): TDestinationDescription => {
  if (!destination) return { summary: "None", detail: "Pressing it would open nothing." };
  if (destination.type === "link") {
    return { summary: destination.url, detail: "Opens the link in a new tab." };
  }
  return {
    summary: destination.surveyName,
    detail:
      destination.opensAs === "popup"
        ? "Opens the survey as a popup on the page."
        : "Opens the survey's link page in a new tab.",
  };
};

const FEEDBACK_EDGES: Record<"left" | "right" | "bottom", string> = {
  left: "Left edge",
  right: "Right edge",
  bottom: "Bottom edge",
};

const describeFeedbackPlacement = (placement: {
  edge: "left" | "right" | "bottom";
  offset: number;
}): string =>
  `${FEEDBACK_EDGES[placement.edge]}, ${placement.offset}% ${placement.edge === "bottom" ? "from the left" : "from the top"}`;

const describeBannerPlacement = (placement: {
  placement: "top" | "bottom";
  layout: "inPage" | "overlay";
}): string => {
  if (placement.placement === "bottom") return "Bottom of the page, fixed over the content";
  return placement.layout === "inPage"
    ? "Top of the page, in the page flow (scrolls away)"
    : "Top of the page, fixed over the content";
};

const describePlacement = (creative: TCreativeData, device: "desktop" | "phone"): string =>
  creative.type === "feedbackButton"
    ? describeFeedbackPlacement(creative.styling.position[device] ?? creative.styling.position.desktop)
    : describeBannerPlacement(creative.styling.position[device] ?? creative.styling.position.desktop);

/** Where it sits on desktop, and on phones when that differs. */
export const describePositions = (creative: TCreativeData): { desktop: string; phone: string | null } => {
  const desktop = describePlacement(creative, "desktop");
  const phone = describePlacement(creative, "phone");
  return { desktop, phone: phone === desktop ? null : phone };
};

/** What pressing the creative would do on a live page, for the note shown when it is pressed here. */
export const describePressOutcome = (destination: TCreativeDestinationData | null): string => {
  if (!destination) return "pressing it would open nothing";
  if (destination.type === "link") return `pressing it would open ${destination.url} in a new tab`;
  return destination.opensAs === "popup"
    ? `pressing it would open the survey "${destination.surveyName}" as a popup`
    : `pressing it would open the survey "${destination.surveyName}" in a new tab`;
};
