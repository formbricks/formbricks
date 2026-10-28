import type { CreativeResourceZodType } from "@formbricks/api-v3-schemas";
import type { TCreativeStyle } from "@formbricks/creatives";

/**
 * What `show_creative` adds to `get_creative`'s answer: a text summary for the model and, for the view,
 * the resolved look and the action names. Pure functions, so the wording is pinned by `preview.test.ts`
 * without a database.
 */

export type TCreativeResource = CreativeResourceZodType;

/** The extras the view reads from `_meta.formbricks` (kept in step with `views/creative-preview/model.ts`). */
export type TCreativePreviewMeta = {
  /** The look the SDK applies, computed from the workspace Look & Feel and the creative's own styles. */
  style: TCreativeStyle;
  /** `false` when the workspace styling could not be read and `style` falls back to neutral defaults. */
  styleIsExact: boolean;
  /** Names of the actions that show it, in trigger order; `null` when it shows on page views or they could not be read. */
  triggerNames: string[] | null;
};

const TYPE_LABELS: Record<TCreativeResource["type"], string> = {
  feedbackButton: "feedback button",
  banner: "banner",
};

const STATUS_PHRASES: Record<TCreativeResource["displayStatus"], string> = {
  draft: "a draft, not published",
  scheduled: "scheduled, not started yet",
  active: "active",
  paused: "paused",
  closed: "closed",
  archived: "archived",
};

const REASON_PHRASES = {
  surveyNotActive: "paused with its survey, it comes back when the survey is active again",
  scheduleEnded: "closed, its end time has passed",
  destinationMissing: "paused, it needs a destination and has none",
  actionMissing: "paused, it shows on an action and has none",
} as const;

const describeStatus = ({ displayStatus, displayStatusReason }: TCreativeResource): string =>
  displayStatusReason ? REASON_PHRASES[displayStatusReason] : STATUS_PHRASES[displayStatus];

const describeShows = (
  { distribution }: TCreativeResource,
  triggerNames: readonly string[] | null
): string => {
  const parts: string[] = [];
  if (distribution.showOn === "pageView") {
    parts.push("on every page view");
  } else if (triggerNames && triggerNames.length > 0) {
    parts.push(`when one of these actions fires: ${triggerNames.join(", ")}`);
  } else {
    const count = distribution.triggers.length;
    if (count === 0) parts.push("when an action fires, but none is set");
    else if (count === 1) parts.push("when its action fires");
    else parts.push(`when one of its ${count} actions fires`);
  }
  if (distribution.displayPercentage !== null) {
    parts.push(`to ${distribution.displayPercentage}% of visitors`);
  }
  if (distribution.conditions !== null) parts.push("where its Show when conditions hold");
  return `Shows ${parts.join(", ")}.`;
};

const describeDestination = ({ destination }: TCreativeResource): string => {
  if (!destination) return "It opens nothing.";
  if (destination.type === "link") return `It opens ${destination.url} in a new tab.`;
  return `It opens the survey "${destination.surveyName}" ${
    destination.opensAs === "popup" ? "as a popup" : "in a new tab"
  }.`;
};

const describeSchedule = ({ schedule }: TCreativeResource): string | null => {
  if (schedule.startAt && schedule.endAt) return `Runs ${schedule.startAt} to ${schedule.endAt}.`;
  if (schedule.startAt) return `Runs from ${schedule.startAt}.`;
  if (schedule.endAt) return `Runs until ${schedule.endAt}.`;
  return null;
};

/** The short text every host gets, with or without MCP Apps support: name, kind, status, where it shows. */
export const buildCreativePreviewText = (
  creative: TCreativeResource,
  triggerNames: readonly string[] | null
): string =>
  [
    `Creative "${creative.name}" (${TYPE_LABELS[creative.type]}) is ${describeStatus(creative)}.`,
    describeShows(creative, triggerNames),
    describeSchedule(creative),
    describeDestination(creative),
    ...creative.warnings.map(({ message }) => `Needs attention: ${message}`),
  ]
    .filter((part): part is string => part !== null)
    .join(" ");
