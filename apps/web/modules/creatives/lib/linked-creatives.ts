import "server-only";
import type { Prisma } from "@formbricks/database/prisma";
import type { TAuditEventInput } from "@/modules/ee/audit-logs/lib/handler";

/**
 * The survey side of a creative's Destination (T6, ENG-3868). A survey's **linked creatives** — the
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

/** The survey's linked creatives, by name. */
export const findLinkedCreatives = (
  client: TCreativeClient,
  { surveyId, workspaceId }: TSurveyRef
): Promise<TLinkedCreative[]> =>
  client.creative.findMany({
    where: { surveyId, workspaceId, archivedAt: null },
    select: { id: true, name: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });

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
  const creatives = await tx.creative.findMany({
    where: { surveyId, workspaceId, ...(include === "archived" && { archivedAt: { not: null } }) },
    select: { id: true, name: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
  if (creatives.length === 0) return [];

  await tx.creative.updateMany({
    where: { id: { in: creatives.map(({ id }) => id) }, surveyId },
    data: { surveyId: null },
  });
  return creatives;
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
 * request is fine, the survey's state isn't, and relinking, archiving or deleting the creatives clears
 * it. Listed in `EXPECTED_ERROR_NAMES`, so server actions and the v1 API surface its message.
 */
export class SurveyLinkedCreativesError extends Error {
  readonly statusCode = 409;

  constructor(
    readonly blockedChange: TLinkedCreativesBlockedChange,
    readonly creatives: readonly TLinkedCreative[]
  ) {
    const names = creatives.map(({ id, name }) => `"${name}" (${id})`).join(", ");
    super(
      `${BLOCKED_CHANGE_LABELS[blockedChange]} while creatives open this survey: ${names}. Relink, archive or delete them first.`
    );
    this.name = "SurveyLinkedCreativesError";
  }
}
