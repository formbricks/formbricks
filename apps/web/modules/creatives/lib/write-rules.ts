import type { z } from "zod";
import type { CreateCreativeRequestZodType, PatchCreativeRequestZodType } from "@formbricks/api-v3-schemas";
import { ZShowConditions } from "@formbricks/types/show-conditions";
import type { InvalidParam } from "@/app/api/v3/lib/response";
import {
  CREATIVE_TYPE_SCHEMAS,
  DEFAULT_CREATIVE_DISTRIBUTION,
  DEFAULT_CREATIVE_STYLING,
  DESTINATION_SURVEY_ISSUE_REASONS,
  type TCreativeDistribution,
  type TCreativeSchedule,
  type TCreativeState,
  type TCreativeTypedGroups,
  type TDestinationSurveyIssue,
  needsDestination,
} from "./creative";

/**
 * The rules every creative write follows, as pure functions over `TCreativeState`: what a create
 * builds, how a patch replaces groups, what a state must satisfy (always, and to be published), and
 * what restore and duplicate turn a creative into. The service runs them; nothing here touches storage.
 */

export type TCreativeCreateInput = CreateCreativeRequestZodType;
export type TCreativePatchInput = PatchCreativeRequestZodType;

type TPlanResult = { ok: true; state: TCreativeState } | { ok: false; invalidParams: InvalidParam[] };

const MAX_NAME_LENGTH = 255;
const COPY_SUFFIX = " (copy)";

const toDate = (value: string | null): Date | null => (value === null ? null : new Date(value));

const toSchedule = (schedule: { startAt: string | null; endAt: string | null }): TCreativeSchedule => ({
  startAt: toDate(schedule.startAt),
  endAt: toDate(schedule.endAt),
});

/** Show when, pruned: empty groups dropped and an empty top-level group stored as `null`. */
const toDistribution = (
  distribution: NonNullable<TCreativeCreateInput["distribution"]>
): TCreativeDistribution => ({
  showOn: distribution.showOn,
  triggers: distribution.triggers.map(({ actionClassId }) => ({ actionClassId })),
  conditions: ZShowConditions.parse(distribution.conditions),
  displayPercentage: distribution.displayPercentage,
});

/** The author's status leaves Draft for the first time: that is the publish. */
const withPublishedAt = (state: TCreativeState, now: Date): TCreativeState =>
  state.status !== "draft" && state.publishedAt === null ? { ...state, publishedAt: now } : state;

const toTypedGroups = (body: TCreativeCreateInput): TCreativeTypedGroups =>
  body.type === "feedbackButton"
    ? {
        type: "feedbackButton",
        content: body.content,
        styling: body.styling ?? DEFAULT_CREATIVE_STYLING.feedbackButton,
      }
    : { type: "banner", content: body.content, styling: body.styling ?? DEFAULT_CREATIVE_STYLING.banner };

export const buildCreativeCreateState = (body: TCreativeCreateInput, now: Date): TCreativeState =>
  withPublishedAt(
    {
      ...toTypedGroups(body),
      name: body.name,
      status: body.status,
      publishedAt: null,
      archivedAt: null,
      defaultLanguage: body.defaultLanguage,
      languages: body.languages ?? [],
      destination: body.destination ?? null,
      distribution: body.distribution ? toDistribution(body.distribution) : DEFAULT_CREATIVE_DISTRIBUTION,
      schedule: body.schedule ? toSchedule(body.schedule) : { startAt: null, endAt: null },
    },
    now
  );

const typeMismatch = (group: "content" | "styling", type: TCreativeState["type"]): InvalidParam => ({
  name: group,
  reason: `This creative is a ${type}, and a creative's type never changes: send a ${type} ${group}.`,
});

/** The sent group parsed with the creative's own type schema, the stored one when omitted, else `null`. */
const parseGroup = <T>(schema: z.ZodType<T>, sent: unknown, stored: T): T | null => {
  if (sent === undefined) return stored;
  const parsed = schema.safeParse(sent);
  return parsed.success ? parsed.data : null;
};

/**
 * The patched `content` and `styling`, checked against the creative's own type. The request schema
 * accepts either type's shape, since a patch doesn't name the type; this is where the wrong one stops.
 */
const patchTypedGroups = (
  current: TCreativeState,
  patch: TCreativePatchInput
): { ok: true; groups: TCreativeTypedGroups } | { ok: false; invalidParams: InvalidParam[] } => {
  const mismatches = (content: unknown, styling: unknown): InvalidParam[] => [
    ...(content === null ? [typeMismatch("content", current.type)] : []),
    ...(styling === null ? [typeMismatch("styling", current.type)] : []),
  ];

  if (current.type === "feedbackButton") {
    const { content: contentSchema, styling: stylingSchema } = CREATIVE_TYPE_SCHEMAS.feedbackButton;
    const content = parseGroup(contentSchema, patch.content, current.content);
    const styling = parseGroup(stylingSchema, patch.styling, current.styling);
    if (content === null || styling === null)
      return { ok: false, invalidParams: mismatches(content, styling) };
    return { ok: true, groups: { type: "feedbackButton", content, styling } };
  }

  const { content: contentSchema, styling: stylingSchema } = CREATIVE_TYPE_SCHEMAS.banner;
  const content = parseGroup(contentSchema, patch.content, current.content);
  const styling = parseGroup(stylingSchema, patch.styling, current.styling);
  if (content === null || styling === null) return { ok: false, invalidParams: mismatches(content, styling) };
  return { ok: true, groups: { type: "banner", content, styling } };
};

/** Each group the patch sends replaces the stored one as a whole; an omitted group stays as it is. */
export const applyCreativePatch = (
  current: TCreativeState,
  patch: TCreativePatchInput,
  now: Date
): TPlanResult => {
  const groups = patchTypedGroups(current, patch);
  if (!groups.ok) return groups;

  return {
    ok: true,
    state: withPublishedAt(
      {
        ...current,
        ...groups.groups,
        name: patch.name ?? current.name,
        status: patch.status ?? current.status,
        defaultLanguage: patch.defaultLanguage ?? current.defaultLanguage,
        languages: patch.languages ?? current.languages,
        destination: patch.destination === undefined ? current.destination : patch.destination,
        distribution: patch.distribution ? toDistribution(patch.distribution) : current.distribution,
        schedule: patch.schedule ? toSchedule(patch.schedule) : current.schedule,
      },
      now
    ),
  };
};

type TTextMap = { path: string; keys: string[] };

const getTextMaps = (groups: TCreativeTypedGroups): TTextMap[] => {
  if (groups.type === "feedbackButton") {
    return [{ path: "content.label", keys: Object.keys(groups.content.label) }];
  }
  const { message, button, accessibleName } = groups.content;
  return [
    { path: "content.message", keys: Object.keys(message) },
    ...(button ? [{ path: "content.button.label", keys: Object.keys(button.label) }] : []),
    ...(accessibleName ? [{ path: "content.accessibleName", keys: Object.keys(accessibleName) }] : []),
  ];
};

const getLanguageProblems = (state: TCreativeState): InvalidParam[] => {
  const problems: InvalidParam[] = [];
  const seen = new Set<string>();
  state.languages.forEach(({ code }, index) => {
    if (seen.has(code)) {
      problems.push({
        name: `languages[${index}].code`,
        reason: `The language ${code} is listed more than once.`,
        code: "duplicate_locale",
      });
    }
    seen.add(code);
  });

  const declared = new Set([state.defaultLanguage, ...seen]);
  for (const { path, keys } of getTextMaps(state)) {
    if (!keys.includes(state.defaultLanguage)) {
      problems.push({
        name: path,
        reason: `Must hold the default language ${state.defaultLanguage}.`,
        code: "missing_translation",
      });
    }
    for (const key of keys.filter((candidate) => !declared.has(candidate))) {
      problems.push({
        name: `${path}.${key}`,
        reason: `The language ${key} isn't declared in languages.`,
        code: "unsupported_locale",
      });
    }
  }
  return problems;
};

const getDistributionProblems = ({ showOn, triggers }: TCreativeDistribution): InvalidParam[] => {
  const problems: InvalidParam[] = [];
  if (showOn === "pageView" && triggers.length > 0) {
    problems.push({
      name: "distribution.triggers",
      reason: "Triggers apply only when showOn is action; send an empty list with pageView.",
    });
  }
  const seen = new Set<string>();
  triggers.forEach(({ actionClassId }, index) => {
    if (seen.has(actionClassId)) {
      problems.push({
        name: `distribution.triggers[${index}].actionClassId`,
        reason: "This action is listed more than once.",
        code: "duplicate_identifier",
      });
    }
    seen.add(actionClassId);
  });
  return problems;
};

const isBlank = (value: string | undefined): boolean => (value ?? "").trim() === "";

/** What publishing needs on top of a valid state: the rules any status but Draft must meet. */
const getPublishProblems = (state: TCreativeState): InvalidParam[] => {
  const problems: InvalidParam[] = [];
  const language = state.defaultLanguage;
  const missing = (name: string, reason: string): InvalidParam => ({
    name,
    reason,
    code: "missing_required_field",
  });

  if (needsDestination(state) && state.destination === null) {
    problems.push(missing("destination", "Publishing needs a Destination: the survey or link this opens."));
  }
  if (state.type === "feedbackButton") {
    if (isBlank(state.content.label[language])) {
      problems.push(
        missing(`content.label.${language}`, "Publishing needs a label in the default language.")
      );
    }
  } else {
    const runs = state.content.message[language] ?? [];
    if (runs.every((run) => isBlank(run.text))) {
      problems.push(
        missing(`content.message.${language}`, "Publishing needs a message in the default language.")
      );
    }
    if (state.content.button && isBlank(state.content.button.label[language])) {
      problems.push(
        missing(
          `content.button.label.${language}`,
          "Publishing needs a button label in the default language."
        )
      );
    }
  }
  if (state.distribution.showOn === "action" && state.distribution.triggers.length === 0) {
    problems.push(
      missing("distribution.triggers", "Publishing a creative that shows on an action needs an action.")
    );
  }
  return problems;
};

/**
 * Everything wrong with `next`, as `invalid_params`. `previous` is the stored state on a patch, where
 * a published creative may not go back to Draft. References that need the database (the survey, the
 * action classes) are checked by the service inside the write's transaction.
 */
export const validateCreativeState = (
  next: TCreativeState,
  previous: TCreativeState | null = null
): InvalidParam[] => {
  const problems = [...getLanguageProblems(next), ...getDistributionProblems(next.distribution)];

  if (next.type === "banner" && next.content.button === null && next.destination !== null) {
    problems.push({
      name: "destination",
      reason: "A banner without a button opens nothing: set destination to null, or add a button.",
    });
  }
  const { startAt, endAt } = next.schedule;
  if (startAt && endAt && endAt <= startAt) {
    problems.push({ name: "schedule.endAt", reason: "The end must be after the start." });
  }
  if (previous && previous.status !== "draft" && next.status === "draft") {
    problems.push({
      name: "status",
      reason: "A published creative can't go back to Draft: pause or close it instead.",
    });
  }
  if (next.status !== "draft") problems.push(...getPublishProblems(next));
  return problems;
};

/** The references a write's state makes that the database refused, as `invalid_params`. */
export const getCreativeReferenceProblems = ({
  state,
  destinationIssue,
  missingActionClassIds,
}: {
  state: TCreativeState;
  destinationIssue: TDestinationSurveyIssue | null;
  missingActionClassIds: ReadonlySet<string>;
}): InvalidParam[] => {
  const problems: InvalidParam[] = [];
  if (destinationIssue) {
    problems.push({
      name: "destination.surveyId",
      reason: DESTINATION_SURVEY_ISSUE_REASONS[destinationIssue],
      code: "invalid_reference",
    });
  }
  state.distribution.triggers.forEach(({ actionClassId }, index) => {
    if (missingActionClassIds.has(actionClassId)) {
      problems.push({
        name: `distribution.triggers[${index}].actionClassId`,
        reason: "No action with this id exists in the creative's workspace.",
        code: "invalid_reference",
      });
    }
  });
  return problems;
};

/**
 * An archived creative coming back. A survey that can no longer be a Destination is unlinked, and a
 * creative that needs a Destination and has none comes back as Draft, so it never reappears on a site
 * by surprise. Otherwise it keeps the status it had.
 */
export const planCreativeRestore = (
  state: TCreativeState,
  destinationIssue: TDestinationSurveyIssue | null
): TCreativeState => {
  const destination = state.destination?.type === "survey" && destinationIssue ? null : state.destination;
  const restored: TCreativeState = { ...state, archivedAt: null, destination };
  return needsDestination(restored) && destination === null ? { ...restored, status: "draft" } : restored;
};

/** A copy as a new Draft, never archived; a survey that can no longer be a Destination is left out. */
export const planCreativeDuplicate = (
  state: TCreativeState,
  destinationIssue: TDestinationSurveyIssue | null
): TCreativeState => ({
  ...state,
  name: `${state.name.slice(0, MAX_NAME_LENGTH - COPY_SUFFIX.length)}${COPY_SUFFIX}`,
  status: "draft",
  publishedAt: null,
  archivedAt: null,
  destination: state.destination?.type === "survey" && destinationIssue ? null : state.destination,
});
