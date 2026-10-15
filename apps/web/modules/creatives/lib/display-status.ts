// The status a creative shows is derived, never stored (T1 · ENG-3690, approved): the author's own
// status, narrowed by archiving, its schedule and the survey it opens. Nothing writes a status when
// a schedule ends or a survey pauses, so the list, the editor and the API can't disagree.

/** Stored on the row, mirroring the survey statuses. */
export type TCreativeOwnStatus = "draft" | "inProgress" | "paused" | "completed";
export type TCreativeDisplayStatus = "draft" | "scheduled" | "active" | "paused" | "closed" | "archived";
export type TCreativeStatusReason = "survey_not_active" | "schedule_ended" | null;
export type TLinkedSurveyStatus = "inProgress" | "paused" | "completed" | "draft" | "scheduled";

export interface TCreativeStatusInput {
  status: TCreativeOwnStatus;
  archivedAt: Date | null;
  startsAt: Date | null;
  endsAt: Date | null;
  /** Status of the survey the creative opens; null when it opens a link. */
  linkedSurveyStatus: TLinkedSurveyStatus | null;
}

export interface TCreativeDisplayState {
  status: TCreativeDisplayStatus;
  reason: TCreativeStatusReason;
}

export const getCreativeDisplayState = (
  { status, archivedAt, startsAt, endsAt, linkedSurveyStatus }: TCreativeStatusInput,
  now: Date
): TCreativeDisplayState => {
  if (archivedAt) return { status: "archived", reason: null };
  if (status === "draft") return { status: "draft", reason: null };
  if (status === "completed") return { status: "closed", reason: null };
  if (endsAt && endsAt <= now) return { status: "closed", reason: "schedule_ended" };
  if (status === "paused") return { status: "paused", reason: null };
  if (startsAt && startsAt > now) return { status: "scheduled", reason: null };
  if (linkedSurveyStatus && linkedSurveyStatus !== "inProgress") {
    return { status: "paused", reason: "survey_not_active" };
  }
  return { status: "active", reason: null };
};
