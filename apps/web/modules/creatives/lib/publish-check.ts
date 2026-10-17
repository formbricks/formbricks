import { validateDateTimeRange } from "@/modules/ui/components/date-time-picker/lib/date-time";
import { getCreativeFormTexts, isBlankCreativeText, readCreativeFormText } from "./creative-texts";
import { type TCreativeEditorForm, formNeedsDestination } from "./editor-form";
import { hasIncompleteConditions } from "./show-conditions-ui";

/**
 * What blocks Save and Publish in the editor, and which tab owns the fix. These mirror the v3 rules
 * (`write-rules.ts`) so the author is sent to the field before a request is made; the server stays the
 * judge, and whatever it still refuses is routed to a tab by `getInvalidParamTab`.
 *
 * A draft saves with gaps: only what the API would refuse even for a draft blocks it (no name, a link
 * that isn't one, a Show when condition without its value, an end before the start). Anything published
 * must meet every publish rule on each save.
 */

export type TCreativeEditorTab = "content" | "language" | "styling" | "settings" | "schedule";

export type TPublishIssue =
  | "name_missing"
  | "label_missing"
  | "message_missing"
  | "button_label_missing"
  | "survey_missing"
  | "survey_not_allowed"
  | "link_invalid"
  | "action_missing"
  | "condition_incomplete"
  | "end_before_start";

/** `null`: the name field in the header, outside the tabs. */
export const PUBLISH_ISSUE_TABS: Record<TPublishIssue, TCreativeEditorTab | null> = {
  name_missing: null,
  label_missing: "content",
  message_missing: "content",
  button_label_missing: "content",
  survey_missing: "content",
  survey_not_allowed: "content",
  link_invalid: "content",
  action_missing: "settings",
  condition_incomplete: "settings",
  end_before_start: "schedule",
};

/** The v3 link Destination rule (`CreativeLinkDestinationInput`), so the editor and the API agree. */
const LINK_PATTERN = /^https?:\/\/\S+$/;
const MAX_LINK_LENGTH = 2048;

const isBlank = (value: string): boolean => value.trim() === "";

const isValidLink = (url: string): boolean => {
  const trimmed = url.trim();
  return trimmed.length <= MAX_LINK_LENGTH && LINK_PATTERN.test(trimmed);
};

const getContentIssues = (content: TCreativeEditorForm["content"]): TPublishIssue[] =>
  getCreativeFormTexts(content).flatMap(({ field, publish }) =>
    publish && isBlankCreativeText(readCreativeFormText(content, field)) ? [publish.issue] : []
  );

/** What publishing knows beyond the form: the picked surveys that can no longer be a Destination. */
export type TPublishContext = Readonly<{ notAllowedSurveyIds?: readonly string[] }>;

const getDestinationIssues = (
  form: TCreativeEditorForm,
  { notAllowedSurveyIds = [] }: TPublishContext
): TPublishIssue[] => {
  if (!formNeedsDestination(form.content)) return [];
  const { destination } = form;
  if (destination.type === "survey") {
    if (!destination.surveyId) return ["survey_missing"];
    return notAllowedSurveyIds.includes(destination.surveyId) ? ["survey_not_allowed"] : [];
  }
  return isValidLink(destination.url) ? [] : ["link_invalid"];
};

/** When an action fires needs an action; a condition the card left without its value is refused by the API. */
const getActionIssues = ({ distribution }: TCreativeEditorForm): TPublishIssue[] =>
  distribution.showOn === "action" && distribution.actionClassIds.length === 0 ? ["action_missing"] : [];

const getConditionIssues = ({ distribution }: TCreativeEditorForm): TPublishIssue[] =>
  hasIncompleteConditions(distribution.conditions) ? ["condition_incomplete"] : [];

const getScheduleIssues = ({ schedule }: TCreativeEditorForm): TPublishIssue[] =>
  validateDateTimeRange(schedule.startAt, schedule.endAt) ? ["end_before_start"] : [];

const getNameIssues = ({ name }: TCreativeEditorForm): TPublishIssue[] =>
  isBlank(name) ? ["name_missing"] : [];

export const getPublishIssues = (
  form: TCreativeEditorForm,
  context: TPublishContext = {}
): TPublishIssue[] => [
  ...getNameIssues(form),
  ...getContentIssues(form.content),
  ...getDestinationIssues(form, context),
  ...getActionIssues(form),
  ...getConditionIssues(form),
  ...getScheduleIssues(form),
];

/** What stops Save: everything Publish needs once published; for a draft, only what the API refuses. */
export const getSaveIssues = (
  form: TCreativeEditorForm,
  { published }: { published: boolean }
): TPublishIssue[] => {
  if (published) return getPublishIssues(form);
  const { destination } = form;
  const hasBrokenLink =
    formNeedsDestination(form.content) &&
    destination.type === "link" &&
    !isBlank(destination.url) &&
    !isValidLink(destination.url);
  return [
    ...getNameIssues(form),
    ...(hasBrokenLink ? (["link_invalid"] as const) : []),
    ...getConditionIssues(form),
    ...getScheduleIssues(form),
  ];
};

const PARAM_GROUP_TABS = new Map<string, TCreativeEditorTab>([
  ["content", "content"],
  ["destination", "content"],
  ["defaultLanguage", "language"],
  ["languages", "language"],
  ["styling", "styling"],
  ["distribution", "settings"],
  ["schedule", "schedule"],
]);

/** The tab that edits a field a v3 write refused (its `invalid_params[].name`); `null` for the header. */
export const getInvalidParamTab = (paramName: string): TCreativeEditorTab | null => {
  const [group] = paramName.split(/[.[]/);
  return PARAM_GROUP_TABS.get(group) ?? null;
};
