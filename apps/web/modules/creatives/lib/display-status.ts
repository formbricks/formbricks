import type {
  CreativeDisplayStatusReasonZodType,
  CreativeDisplayStatusZodType,
  CreativeStatusZodType,
} from "@formbricks/api-v3-schemas";

// The status a creative shows is derived, never stored (ADR 0002): the author's own status, narrowed by
// archiving, its schedule and the survey it opens. Nothing writes a status when a schedule ends or a
// survey pauses, so the list, the editor, the API and the SDK can't disagree. `creativeDisplayStatusSql`
// (display-status-sql.ts) is the SQL twin the list filter uses; `display-status-cases.ts` holds both to
// one case table.

/** Stored on the row: the author's intent, the same values as a survey's status. */
export type TCreativeStatus = CreativeStatusZodType;
export type TCreativeDisplayStatus = CreativeDisplayStatusZodType;
export type TCreativeDisplayStatusReason = CreativeDisplayStatusReasonZodType;

/** The Destination survey's own lifecycle facts. Active means `inProgress` and not archived. */
export interface TCreativeDestinationSurveyState {
  status: "draft" | "inProgress" | "paused" | "completed";
  archivedAt: Date | null;
}

export interface TCreativeStatusInput {
  status: TCreativeStatus;
  archivedAt: Date | null;
  startAt: Date | null;
  endAt: Date | null;
  /** The survey the creative opens; `null` when it opens a link or nothing. */
  destinationSurvey: TCreativeDestinationSurveyState | null;
}

export interface TCreativeDisplayState {
  status: TCreativeDisplayStatus;
  reason: TCreativeDisplayStatusReason;
}

export const isDestinationSurveyActive = (survey: TCreativeDestinationSurveyState): boolean =>
  survey.status === "inProgress" && survey.archivedAt === null;

export const getCreativeDisplayState = (
  { status, archivedAt, startAt, endAt, destinationSurvey }: TCreativeStatusInput,
  now: Date
): TCreativeDisplayState => {
  if (archivedAt) return { status: "archived", reason: null };
  if (status === "draft") return { status: "draft", reason: null };
  if (status === "completed") return { status: "closed", reason: null };
  if (endAt && endAt <= now) return { status: "closed", reason: "scheduleEnded" };
  if (status === "paused") return { status: "paused", reason: null };
  if (startAt && startAt > now) return { status: "scheduled", reason: null };
  if (destinationSurvey && !isDestinationSurveyActive(destinationSurvey)) {
    return { status: "paused", reason: "surveyNotActive" };
  }
  return { status: "active", reason: null };
};
