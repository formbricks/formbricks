import type {
  CreativeDisplayStatusReasonZodType,
  CreativeDisplayStatusZodType,
  CreativeStatusZodType,
} from "@formbricks/api-v3-schemas";

// The status a creative shows is derived, never stored (ADR 0002): the author's own status, narrowed by
// archiving, its schedule, what delivery needs (a Destination, an action) and the survey it opens. Nothing writes a status when a schedule ends or a
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

/**
 * Why the SDK can never show a published creative (`toCreativePayloads` leaves it out): it needs a
 * Destination and has none, or it shows on an action and has none (`getCreativeDeliveryGap`).
 */
export type TCreativeDeliveryGap = Extract<
  TCreativeDisplayStatusReason,
  "destinationMissing" | "actionMissing"
>;

/** The one rule delivery and the derived status share for what keeps a creative off every site. */
export const getCreativeDeliveryGap = ({
  needsDestination,
  hasDestination,
  showOn,
  triggerCount,
}: Readonly<{
  /** A feedback button, or a banner with a button. */
  needsDestination: boolean;
  hasDestination: boolean;
  showOn: "pageView" | "action";
  triggerCount: number;
}>): TCreativeDeliveryGap | null => {
  if (needsDestination && !hasDestination) return "destinationMissing";
  if (showOn === "action" && triggerCount === 0) return "actionMissing";
  return null;
};

export interface TCreativeStatusInput {
  status: TCreativeStatus;
  archivedAt: Date | null;
  startAt: Date | null;
  endAt: Date | null;
  /** The survey the creative opens; `null` when it opens a link or nothing. */
  destinationSurvey: TCreativeDestinationSurveyState | null;
  /** What it lacks to be delivered at all; `null` when nothing. */
  deliveryGap: TCreativeDeliveryGap | null;
}

export interface TCreativeDisplayState {
  status: TCreativeDisplayStatus;
  reason: TCreativeDisplayStatusReason;
}

export const isDestinationSurveyActive = (survey: TCreativeDestinationSurveyState): boolean =>
  survey.status === "inProgress" && survey.archivedAt === null;

export const getCreativeDisplayState = (
  { status, archivedAt, startAt, endAt, destinationSurvey, deliveryGap }: TCreativeStatusInput,
  now: Date
): TCreativeDisplayState => {
  if (archivedAt) return { status: "archived", reason: null };
  if (status === "draft") return { status: "draft", reason: null };
  if (status === "completed") return { status: "closed", reason: null };
  if (endAt && endAt <= now) return { status: "closed", reason: "scheduleEnded" };
  if (status === "paused") return { status: "paused", reason: null };
  // Never delivered, so never shown: Paused, with what it lacks, rather than Scheduled or Active.
  if (deliveryGap) return { status: "paused", reason: deliveryGap };
  if (startAt && startAt > now) return { status: "scheduled", reason: null };
  if (destinationSurvey && !isDestinationSurveyActive(destinationSurvey)) {
    return { status: "paused", reason: "surveyNotActive" };
  }
  return { status: "active", reason: null };
};
