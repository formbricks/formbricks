import { validateDateTimeRange } from "@/modules/ui/components/date-time-picker/lib/date-time";
import type { TCreative } from "../types";
import { hasIncompleteConditions } from "./show-conditions-ui";

// What blocks Publish, and which editor tab owns the fix. A draft saves with gaps; only an issue that
// would store a schedule that can never be valid (end before start) blocks Save as well.

export type TCreativeEditorTab = "content" | "styling" | "settings" | "schedule";

export type TPublishIssue =
  | "name_missing"
  | "message_missing"
  | "survey_missing"
  | "link_invalid"
  | "condition_empty"
  | "end_before_start";

export const PUBLISH_ISSUE_TABS: Record<TPublishIssue, TCreativeEditorTab | null> = {
  name_missing: null,
  message_missing: "content",
  survey_missing: "content",
  link_invalid: "content",
  condition_empty: "settings",
  end_before_start: "schedule",
};

const SAVE_BLOCKING_ISSUES: readonly TPublishIssue[] = ["end_before_start"];

const isHttpUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
};

export const getPublishIssues = (creative: TCreative): TPublishIssue[] => {
  const issues: TPublishIssue[] = [];
  if (!creative.name.trim()) issues.push("name_missing");
  if (creative.type === "banner" && !creative.content.message.trim()) issues.push("message_missing");
  if (creative.action.kind === "survey" && !creative.action.surveyId) issues.push("survey_missing");
  if (creative.action.kind === "link" && !isHttpUrl(creative.action.url.trim())) issues.push("link_invalid");
  if (hasIncompleteConditions(creative.targeting.showConditions)) issues.push("condition_empty");
  if (validateDateTimeRange(creative.startsAt, creative.endsAt)) issues.push("end_before_start");
  return issues;
};

/** The subset of publish issues that also stops a draft from being saved. */
export const getSaveIssues = (creative: TCreative): TPublishIssue[] =>
  getPublishIssues(creative).filter((issue) => SAVE_BLOCKING_ISSUES.includes(issue));
