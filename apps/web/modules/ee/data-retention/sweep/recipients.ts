import "server-only";
import { prisma } from "@formbricks/database";
import { type TUserLocale, ZUserLocale } from "@formbricks/types/user";
import type { TAuthorizationActor } from "@/lib/authorization";
import { filterReadableSurveyIds, lookupAuthorizedWorkspaceIds } from "@/lib/authorization/resource-list";
import { AUTHZED_MAX_BULK_CHECK_ITEMS } from "@/lib/authzed/constants";
import { findEffectivelyRestrictedSurveyIds } from "@/lib/survey/visibility/outbound";
import { isSurveyHiddenFromMember } from "@/lib/survey/visibility/predicate";
import { mapWithConcurrency } from "@/lib/utils/map-with-concurrency";
import { RETENTION_RECIPIENT_CHECK_CONCURRENCY } from "./constants";

export type TNoticeRecipient = { userId: string; email: string; name: string; locale: TUserLocale };

export type TNoticeSurvey = {
  id: string;
  workspaceId: string;
  ownerId: string | null;
  createdBy: string | null;
};

/** Which of `surveyIds` the user may read: the app's own survey read check, in one bulk call. */
export type TSurveyReadCheck = (
  actor: TAuthorizationActor,
  surveyIds: ReadonlyArray<string>
) => Promise<ReadonlySet<string>>;

/**
 * The app's read check for `surveys`, as every read route applies it: the workspace first (looked up once
 * per person), then the graph's survey check (ENG-3282). The graph check takes workspace access as given,
 * and lets every survey through while survey visibility isn't enforced yet, so it never stands alone.
 */
const appSurveyReadCheck = (surveys: readonly TNoticeSurvey[]): TSurveyReadCheck => {
  const workspaceOf = new Map(surveys.map((survey) => [survey.id, survey.workspaceId]));
  const workspacesOf = new Map<string, Promise<ReadonlySet<string>>>();
  return async (actor, surveyIds) => {
    let workspaces = workspacesOf.get(actor.id);
    if (!workspaces) {
      workspaces = lookupAuthorizedWorkspaceIds(actor).then((ids) => new Set(ids));
      workspacesOf.set(actor.id, workspaces);
    }
    const readableWorkspaces = await workspaces;
    const inReadableWorkspaces = surveyIds.filter((surveyId) =>
      readableWorkspaces.has(workspaceOf.get(surveyId) ?? "")
    );
    return filterReadableSurveyIds(actor, inReadableWorkspaces);
  };
};

type TCandidate = TNoticeRecipient & { role: "owner" | "manager" | "member" };

/**
 * Who is told about a survey's retention: the first of its owner, its creator, then the organisation's
 * owners and managers, who is an active member of the organisation (any role but billing) and can read
 * the survey. Surveys with nobody eligible are left out of the result, and the caller skips them
 * (`noRecipient`): a notice no one receives must never let the action run.
 *
 * The owner and creator are checked with the app's own survey read check (`appSurveyReadCheck`), in bulk
 * calls of at most `AUTHZED_MAX_BULK_CHECK_ITEMS` surveys per person, a few in flight at once, so a
 * workspace they can't read, or a restricted survey (ENG-3282), rules them out. That check reads the graph, which
 * lags a visibility change until it is projected, so the survey's effective visibility is applied too
 * (`isSurveyHiddenFromMember`): a change still pending counts as restricted at once, as on every read path.
 * Owners and managers can read every survey in the organisation, so they need no check. A failed check
 * throws: the run fails closed rather than emailing a fallback.
 */
export const resolveSurveyNoticeRecipients = async (
  organizationId: string,
  surveys: readonly TNoticeSurvey[],
  readCheck?: TSurveyReadCheck
): Promise<Map<string, TNoticeRecipient>> => {
  const recipients = new Map<string, TNoticeRecipient>();
  if (surveys.length === 0) return recipients;
  const canRead = readCheck ?? appSurveyReadCheck(surveys);

  const personalIds = [
    ...new Set(surveys.flatMap((survey) => [survey.ownerId, survey.createdBy]).filter(isPresent)),
  ];
  const members = await prisma.membership.findMany({
    where: {
      organizationId,
      role: { not: "billing" },
      accepted: true,
      user: { isActive: true },
      OR: [{ userId: { in: personalIds } }, { role: { in: ["owner", "manager"] } }],
    },
    select: { role: true, user: { select: { id: true, email: true, name: true, locale: true } } },
  });
  const byId = new Map<string, TCandidate>(
    members.map((member) => [
      member.user.id,
      {
        userId: member.user.id,
        email: member.user.email,
        name: member.user.name,
        locale: ZUserLocale.catch("en-US").parse(member.user.locale),
        role: member.role as TCandidate["role"],
      },
    ])
  );

  // Owners before managers, then a stable order, so the fallback is the same person every night.
  const rank = (candidate: TCandidate) => (candidate.role === "owner" ? 0 : 1);
  const fallbacks = [...byId.values()]
    .filter((candidate) => candidate.role === "owner" || candidate.role === "manager")
    .sort((a, b) => rank(a) - rank(b) || a.userId.localeCompare(b.userId));

  const checks = personalIds
    .filter((userId) => byId.has(userId))
    .flatMap((userId) => {
      const surveyIds = surveys
        .filter((survey) => survey.ownerId === userId || survey.createdBy === userId)
        .map((survey) => survey.id);
      const chunks: { userId: string; surveyIds: string[] }[] = [];
      for (let i = 0; i < surveyIds.length; i += AUTHZED_MAX_BULK_CHECK_ITEMS) {
        chunks.push({ userId, surveyIds: surveyIds.slice(i, i + AUTHZED_MAX_BULK_CHECK_ITEMS) });
      }
      return chunks;
    });
  const [results, restrictedIds] = await Promise.all([
    mapWithConcurrency(checks, RETENTION_RECIPIENT_CHECK_CONCURRENCY, async (check) => ({
      userId: check.userId,
      allowed: await canRead({ type: "user", id: check.userId }, check.surveyIds),
    })),
    // Effectively restricted surveys, from the stored facts even before visibility is enforced. Only needed
    // when a check runs.
    checks.length === 0
      ? Promise.resolve([])
      : findEffectivelyRestrictedSurveyIds(surveys.map((survey) => survey.id)),
  ]);
  const restricted = new Set(restrictedIds);
  const readable = new Map<string, Set<string>>();
  for (const { userId, allowed } of results) {
    readable.set(userId, new Set([...(readable.get(userId) ?? []), ...allowed]));
  }

  for (const survey of surveys) {
    const personal = [survey.ownerId, survey.createdBy]
      .filter(isPresent)
      .map((userId) => byId.get(userId))
      .find(
        (candidate) =>
          candidate &&
          readable.get(candidate.userId)?.has(survey.id) &&
          !isSurveyHiddenFromMember({
            role: candidate.role,
            userId: candidate.userId,
            ownerId: survey.ownerId,
            effectivelyRestricted: restricted.has(survey.id),
          })
      );
    const recipient = personal ?? fallbacks[0];
    if (recipient) {
      const { role: _role, ...rest } = recipient;
      recipients.set(survey.id, rest);
    }
  }
  return recipients;
};

const isPresent = (value: string | null): value is string => value !== null;
