import { z } from "zod";
import type { CreativeResourceBaseZodType } from "@formbricks/api-v3-schemas";
import type { TSurveyStatus } from "@formbricks/types/surveys/types";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import type { TSurveyVisibilityBlocker } from "@/modules/survey/visibility/types";
import { type TCreativeDestinationSurveyState, getCreativeDisplayState } from "./display-status";

/**
 * What the survey screens show about the creatives that open a survey (T6, ENG-3579, ENG-3868): who
 * a status change affects, what the editor's cards say, and why a change is refused. Pure functions
 * over the creatives `GET /api/v3/creatives?surveyId=` returns; the screens fetch, these decide.
 */

/** A **linked creative** as the survey screens read it: never archived, its Destination this survey. */
export type TSurveyLinkedCreative = Pick<
  CreativeResourceBaseZodType,
  "id" | "name" | "status" | "displayStatus" | "displayStatusReason" | "archivedAt" | "schedule"
>;

const ACTIVE_SURVEY: TCreativeDestinationSurveyState = { status: "inProgress", archivedAt: null };

const toDate = (value: string | null): Date | null => (value === null ? null : new Date(value));

/**
 * Whether the creative shows, now or once its schedule starts, while its survey is Active: the ones a
 * survey pausing takes down with it (Paused with its survey) and a survey resuming brings back. Drafts,
 * creatives their author paused or closed, and finished schedules are unaffected either way.
 */
const showsWithActiveSurvey = (creative: TSurveyLinkedCreative, now: Date): boolean => {
  const { status } = getCreativeDisplayState(
    {
      status: creative.status,
      archivedAt: toDate(creative.archivedAt),
      startAt: toDate(creative.schedule.startAt),
      endAt: toDate(creative.schedule.endAt),
      destinationSurvey: ACTIVE_SURVEY,
    },
    now
  );
  return status === "active" || status === "scheduled";
};

export type TSurveyStatusChangeKind = "pause" | "close" | "resume";

export type TSurveyStatusChangePlan = Readonly<{
  kind: TSurveyStatusChangeKind;
  /** The creatives the change pauses or brings back, in the order given. */
  creatives: TSurveyLinkedCreative[];
}>;

const getStatusChangeKind = (from: TSurveyStatus, to: TSurveyStatus): TSurveyStatusChangeKind | null => {
  if (from === "inProgress" && to === "paused") return "pause";
  if (from === "inProgress" && to === "completed") return "close";
  if ((from === "paused" || from === "completed") && to === "inProgress") return "resume";
  return null;
};

/**
 * The confirmation a survey status change needs, or `null` when it needs none: the change doesn't
 * stop or restart the survey, or no linked creative shows with it.
 */
export const planSurveyStatusChange = ({
  from,
  to,
  creatives,
  now,
}: Readonly<{
  from: TSurveyStatus;
  to: TSurveyStatus;
  creatives: readonly TSurveyLinkedCreative[];
  now: Date;
}>): TSurveyStatusChangePlan | null => {
  const kind = getStatusChangeKind(from, to);
  if (!kind) return null;
  const affected = creatives.filter((creative) => showsWithActiveSurvey(creative, now));
  return affected.length > 0 ? { kind, creatives: affected } : null;
};

/**
 * The creatives to pause before the survey resumes, when the author chose "Keep these creatives
 * paused": the ones the resume would bring back. Pausing writes the creative's own status, so it
 * stays paused through later survey changes until its author resumes it.
 */
export const getCreativesToKeepPaused = (plan: TSurveyStatusChangePlan, keepPaused: boolean): string[] =>
  plan.kind === "resume" && keepPaused ? plan.creatives.map(({ id }) => id) : [];

/**
 * How creatives open the survey, for the editor's Recontact & Visibility card. A click ignores the
 * survey's recontact, cooldown and display limits (ENG-3579), so when only creatives open it those
 * settings govern nothing and are switched off; with actions of its own they still govern its
 * automatic popups. `null` when no linked creative opens it.
 */
export type TCreativeOpenedMode = "creativesOnly" | "creativesAndActions";

export const getCreativeOpenedMode = ({
  triggers,
  creatives,
}: Readonly<{
  /** The survey's own triggers; the editor's list can hold empty slots, which aren't actions. */
  triggers: readonly unknown[];
  creatives: readonly TSurveyLinkedCreative[];
}>): TCreativeOpenedMode | null => {
  if (creatives.length === 0) return null;
  return triggers.some(Boolean) ? "creativesAndActions" : "creativesOnly";
};

/**
 * Whether the switch for single-use links or a PIN is locked: a creative's Destination can't have
 * either (Δ11), so a survey creatives open can't turn one on. The server refuses only turning one on
 * (409), so a setting already on stays free to turn off.
 */
export const isDestinationSettingLocked = ({
  creatives,
  isOn,
}: Readonly<{ creatives: readonly TSurveyLinkedCreative[]; isOn: boolean }>): boolean =>
  creatives.length > 0 && !isOn;

const LINKED_CREATIVES_PROBLEM_CODE = "survey_has_linked_creatives";

// `LinkedCreativesProblem.yml`'s `details`; the problem schemas aren't generated, so it is read here.
const ZLinkedCreativesDetails = z.object({
  creatives: z.array(z.object({ id: z.string(), name: z.string() })),
});

/**
 * The creatives that refused a survey delete (409 `survey_has_linked_creatives`), as blockers for
 * the visibility blockers UI, or `null` when the error is anything else. A refusal whose `details`
 * can't be read still counts, naming no one.
 */
export const getLinkedCreativesBlockers = (error: unknown): TSurveyVisibilityBlocker[] | null => {
  if (!(error instanceof V3ApiError) || error.code !== LINKED_CREATIVES_PROBLEM_CODE) return null;
  const details = ZLinkedCreativesDetails.safeParse(error.details);
  if (!details.success) return [];
  return details.data.creatives.map(({ id, name }) => ({ id, name, type: "creative" }));
};
