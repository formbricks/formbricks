import {
  type TCreativeDestinationSurveyState,
  type TCreativeDisplayState,
  getCreativeDeliveryGap,
  getCreativeDisplayState,
} from "./display-status";
import type { TCreativePatchBody, TCreativeResource } from "./editor-form";

/**
 * A save never takes a creative live by itself: an author going live does it on purpose,
 * with Publish, Resume or the status menu. When the editor's Save would turn a creative that isn't Active
 * now into an Active one (a link instead of its paused survey, the Destination or action it lacked, a
 * schedule that would show it right away), the save pauses it instead, as its author, and the editor
 * offers Resume. A save that leaves it off the site anyway, or schedules it for later, goes out as it is.
 * The API and MCP don't apply this: their clients set `status` themselves.
 */

export interface TSaveStatusContext {
  /** The Destination surveys' states by id (the editor's picker); one not listed doesn't hold it back. */
  surveys: ReadonlyMap<string, TCreativeDestinationSurveyState>;
  now: Date;
}

/** The picker's surveys as the derived status reads them. */
export const toSurveyStates = (
  options: readonly { id: string; status: TCreativeDestinationSurveyState["status"]; archivedAt?: Date }[]
): Map<string, TCreativeDestinationSurveyState> =>
  new Map(options.map(({ id, status, archivedAt }) => [id, { status, archivedAt: archivedAt ?? null }]));

/** What the derived status reads from a creative, as stored or as a save would leave it. */
interface TStatusFacts {
  status: TCreativeResource["status"];
  schedule: { startAt: string | null; endAt: string | null };
  destination: { type: "survey"; surveyId: string } | { type: "link" } | null;
  /** A feedback button, or a banner with a button. */
  needsDestination: boolean;
  distribution: { showOn: "pageView" | "action"; triggers: readonly unknown[] };
}

const toDate = (value: string | null): Date | null => (value === null ? null : new Date(value));

const hasBannerButton = (content: NonNullable<TCreativePatchBody["content"]>): boolean =>
  "button" in content && content.button !== null;

const getDisplayState = (
  facts: TStatusFacts,
  archivedAt: string | null,
  { surveys, now }: TSaveStatusContext
): TCreativeDisplayState =>
  getCreativeDisplayState(
    {
      status: facts.status,
      archivedAt: toDate(archivedAt),
      startAt: toDate(facts.schedule.startAt),
      endAt: toDate(facts.schedule.endAt),
      destinationSurvey:
        facts.destination?.type === "survey" ? (surveys.get(facts.destination.surveyId) ?? null) : null,
      deliveryGap: getCreativeDeliveryGap({
        needsDestination: facts.needsDestination,
        hasDestination: facts.destination !== null,
        showOn: facts.distribution.showOn,
        triggerCount: facts.distribution.triggers.length,
      }),
    },
    now
  );

/** Where the stored creative stands and where the body would take it; a group the body leaves out stays. */
const toFacts = (resource: TCreativeResource, body: TCreativePatchBody = {}): TStatusFacts => ({
  status: body.status ?? resource.status,
  schedule: body.schedule ?? resource.schedule,
  destination: body.destination === undefined ? resource.destination : body.destination,
  needsDestination: resource.type === "feedbackButton" || hasBannerButton(body.content ?? resource.content),
  distribution: body.distribution ?? resource.distribution,
});

/**
 * The body Save sends, and whether it was paused to keep the creative from going live by itself. Both
 * states are derived at the same `now`, so a creative whose start passed while the editor was open isn't
 * held back: it went live on its schedule, not by the save.
 */
export const keepSaveFromGoingLive = (
  resource: TCreativeResource,
  body: TCreativePatchBody,
  context: TSaveStatusContext
): { body: TCreativePatchBody; keptPaused: boolean } => {
  if (body.status !== undefined) return { body, keptPaused: false };
  const before = getDisplayState(toFacts(resource), resource.archivedAt, context);
  const after = getDisplayState(toFacts(resource, body), resource.archivedAt, context);
  if (before.status === "active" || after.status !== "active") return { body, keptPaused: false };
  return { body: { ...body, status: "paused" }, keptPaused: true };
};
