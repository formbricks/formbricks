import "server-only";
import type { Prisma } from "@formbricks/database/prisma";
import type { TAuditEventInput } from "@/modules/ee/audit-logs/lib/handler";

/**
 * The survey side of a creative's Destination (ENG-3868). A survey's **linked creatives** — the
 * non-archived creatives whose Destination it is — hold it: while one exists, the survey can't be
 * deleted, restricted, or turned single-use or PIN-protected. Archived creatives never hold a survey;
 * a change that needs the survey gone or restricted unlinks them, and the 30-day archive purge unlinks
 * every creative.
 *
 * Every read and write here runs on the client it is given, so a caller checks and unlinks inside the
 * transaction that holds the survey's lock — the lock a creative write takes when it links the survey
 * (`lockDestinationSurvey` in `repository.ts`).
 */

type TCreativeClient = Pick<Prisma.TransactionClient, "creative">;

type TSurveyRef = Readonly<{ surveyId: string; workspaceId: string }>;

export type TLinkedCreative = Readonly<{ id: string; name: string }>;

/**
 * The most creatives one read returns. Naming a survey's linked creatives (a 409, a blocker list) stops
 * here: a refusal needs only one, and nobody acts on more names than this. The unlink reads in pages of
 * this size until none are left, so it never stops short.
 */
export const LINKED_CREATIVES_READ_LIMIT = 250;

/**
 * The most pages one unlink clears: 40 × 250 = 10 000 creatives on one survey, orders of magnitude past
 * any real workspace. A survey with more makes the unlink throw, rolling back the caller's transaction,
 * rather than loop on unbounded or leave creatives pointing at a survey that is going away.
 */
export const MAX_UNLINK_PAGES = 40;

const BY_NAME = [{ name: "asc" as const }, { id: "asc" as const }];

/** The survey's linked creatives, by name: the first `LINKED_CREATIVES_READ_LIMIT` of them. */
export const findLinkedCreatives = (
  client: TCreativeClient,
  { surveyId, workspaceId }: TSurveyRef
): Promise<TLinkedCreative[]> =>
  client.creative.findMany({
    where: { surveyId, workspaceId, archivedAt: null },
    select: { id: true, name: true },
    orderBy: BY_NAME,
    take: LINKED_CREATIVES_READ_LIMIT,
  });

/** Whether the survey has any linked creative: what lets an app survey publish without a trigger. */
export const hasLinkedCreatives = async (
  client: TCreativeClient,
  { surveyId, workspaceId }: TSurveyRef
): Promise<boolean> =>
  (await client.creative.findFirst({
    where: { surveyId, workspaceId, archivedAt: null },
    select: { id: true },
  })) !== null;

/**
 * Clears the Destination of the survey's archived creatives, or of all of them, and returns what it
 * unlinked so the caller can audit it once the transaction commits. Status is left alone: it records
 * the author's intent, and a creative left without the Destination it needs says so in its warnings
 * (and comes back from a restore as a Draft).
 */
export const unlinkSurveyCreatives = async (
  tx: TCreativeClient,
  { surveyId, workspaceId, include }: TSurveyRef & Readonly<{ include: "archived" | "all" }>
): Promise<TLinkedCreative[]> => {
  const unlinked: TLinkedCreative[] = [];
  // Each page is unlinked before the next read, so that read only finds the rest: the loop ends after
  // ceil(linked / limit) passes with every creative unlinked, each returned for its audit entry. One read
  // past the ceiling tells a survey with exactly that many apart from one with more.
  for (let pageIndex = 0; pageIndex <= MAX_UNLINK_PAGES; pageIndex++) {
    const page = await tx.creative.findMany({
      where: { surveyId, workspaceId, ...(include === "archived" && { archivedAt: { not: null } }) },
      select: { id: true, name: true },
      orderBy: BY_NAME,
      take: LINKED_CREATIVES_READ_LIMIT,
    });
    if (page.length === 0) return unlinked;
    if (pageIndex === MAX_UNLINK_PAGES) break;

    await tx.creative.updateMany({
      where: { id: { in: page.map(({ id }) => id) }, surveyId },
      data: { surveyId: null },
    });
    unlinked.push(...page);
    if (page.length < LINKED_CREATIVES_READ_LIMIT) return unlinked;
  }
  throw new Error(
    `Survey ${surveyId} has more than ${MAX_UNLINK_PAGES * LINKED_CREATIVES_READ_LIMIT} creatives to unlink`
  );
};

/** Who made the survey-side change: the request's own audit entry, or the system for the purge. */
type TUnlinkAuditActor = Omit<
  TAuditEventInput,
  "action" | "targetType" | "targetId" | "status" | "oldObject" | "newObject"
>;

/**
 * One audit entry per creative a survey-side change unlinked: the same actor and request as the change
 * itself, recorded as an update of the creative's Destination to nothing.
 */
export const toUnlinkedCreativeAuditEvents = (
  actor: TUnlinkAuditActor,
  surveyId: string,
  creatives: readonly TLinkedCreative[]
): TAuditEventInput[] =>
  creatives.map(({ id }) => ({
    ...actor,
    // The change's own eventId correlates a failure; these entries are only written for a success.
    eventId: undefined,
    action: "updated",
    targetType: "creative",
    targetId: id,
    status: "success",
    oldObject: { surveyId },
    newObject: { surveyId: null },
  }));

/** A change to a survey refused because linked creatives open it (409). */
export type TLinkedCreativesBlockedChange = "delete" | "singleUse" | "pin";

type TDestinationSettings = Readonly<{
  singleUse?: Readonly<{ enabled: boolean }> | null;
  pin?: string | null;
}>;

/**
 * The setting a survey save turns on that a creative's Destination can't have — single-use links or a
 * PIN (email verification is fine) — or `null`. Only a change counts: a save that keeps a setting as it
 * was checks nothing.
 */
export const getDestinationSettingTurnedOn = (
  current: TDestinationSettings,
  next: TDestinationSettings
): Extract<TLinkedCreativesBlockedChange, "singleUse" | "pin"> | null => {
  if (!current.singleUse?.enabled && next.singleUse?.enabled) return "singleUse";
  if (!current.pin && next.pin) return "pin";
  return null;
};

/** Refuses `change` while linked creatives open the survey. */
export const assertNoLinkedCreatives = async (
  client: TCreativeClient,
  survey: TSurveyRef,
  change: TLinkedCreativesBlockedChange
): Promise<void> => {
  const creatives = await findLinkedCreatives(client, survey);
  if (creatives.length > 0) throw new SurveyLinkedCreativesError(change, creatives);
};

const BLOCKED_CHANGE_LABELS: Readonly<Record<TLinkedCreativesBlockedChange, string>> = {
  delete: "This survey can't be deleted",
  singleUse: "Single-use links can't be turned on",
  pin: "A PIN can't be set",
};

/**
 * Refuses a change to a survey that its linked creatives would not survive, naming them. A 409: the
 * request is fine, the survey's state isn't. The message tells the author to delete the creatives:
 * pausing or closing one keeps its link. Listed in `EXPECTED_ERROR_NAMES`, so server actions and the v1
 * API surface its message.
 */
export class SurveyLinkedCreativesError extends Error {
  readonly statusCode = 409;

  constructor(
    readonly blockedChange: TLinkedCreativesBlockedChange,
    readonly creatives: readonly TLinkedCreative[]
  ) {
    const names = creatives.map(({ id, name }) => `"${name}" (${id})`).join(", ");
    super(
      `${BLOCKED_CHANGE_LABELS[blockedChange]} while creatives open this survey: ${names}. Delete them first.`
    );
    this.name = "SurveyLinkedCreativesError";
  }
}
