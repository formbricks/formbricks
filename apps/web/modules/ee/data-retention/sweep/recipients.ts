import "server-only";
import { prisma } from "@formbricks/database";
import { type TUserLocale, ZUserLocale } from "@formbricks/types/user";
import type { TAuthorizationActor } from "@/lib/authorization";
import { filterReadableSurveyIds } from "@/lib/authorization/resource-list";
import { AUTHZED_MAX_BULK_CHECK_ITEMS } from "@/lib/authzed/constants";
import { mapWithConcurrency } from "@/lib/utils/map-with-concurrency";
import { RETENTION_RECIPIENT_CHECK_CONCURRENCY } from "./constants";

export type TNoticeRecipient = { userId: string; email: string; name: string; locale: TUserLocale };

export type TNoticeSurvey = { id: string; ownerId: string | null; createdBy: string | null };

/** Which of `surveyIds` the user may read: the app's own survey read check (ENG-3282), in one bulk call. */
export type TSurveyReadCheck = (
  actor: TAuthorizationActor,
  surveyIds: ReadonlyArray<string>
) => Promise<ReadonlySet<string>>;

type TCandidate = TNoticeRecipient & { role: "owner" | "manager" | "member" };

/**
 * Who is told about a survey's retention: the first of its owner, its creator, then the organisation's
 * owners and managers, who is an active member of the organisation (any role but billing) and can read
 * the survey. Surveys with nobody eligible are left out of the result, and the caller skips them
 * (`noRecipient`): a notice no one receives must never let the action run.
 *
 * The owner and creator are checked with the app's own survey read check, in bulk calls of at most
 * `AUTHZED_MAX_BULK_CHECK_ITEMS` surveys per person, a few in flight at once, so a restricted survey
 * (ENG-3282) or a workspace they have lost access to rules them out. Owners and managers can read every
 * survey in the organisation, so they need no check. A failed check throws: the run fails closed rather
 * than emailing a fallback.
 */
export const resolveSurveyNoticeRecipients = async (
  organizationId: string,
  surveys: readonly TNoticeSurvey[],
  canRead: TSurveyReadCheck = filterReadableSurveyIds
): Promise<Map<string, TNoticeRecipient>> => {
  const recipients = new Map<string, TNoticeRecipient>();
  if (surveys.length === 0) return recipients;

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
  const fallbacks = [...byId.values()]
    .filter((candidate) => candidate.role === "owner" || candidate.role === "manager")
    .sort((a, b) => (a.role === b.role ? a.userId.localeCompare(b.userId) : a.role === "owner" ? -1 : 1));

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
  const results = await mapWithConcurrency(checks, RETENTION_RECIPIENT_CHECK_CONCURRENCY, async (check) => ({
    userId: check.userId,
    allowed: await canRead({ type: "user", id: check.userId }, check.surveyIds),
  }));
  const readable = new Map<string, Set<string>>();
  for (const { userId, allowed } of results) {
    readable.set(userId, new Set([...(readable.get(userId) ?? []), ...allowed]));
  }

  for (const survey of surveys) {
    const personal = [survey.ownerId, survey.createdBy]
      .filter(isPresent)
      .map((userId) => byId.get(userId))
      .find((candidate) => candidate && readable.get(candidate.userId)?.has(survey.id));
    const recipient = personal ?? fallbacks[0];
    if (recipient) {
      const { role: _role, ...rest } = recipient;
      recipients.set(survey.id, rest);
    }
  }
  return recipients;
};

const isPresent = (value: string | null): value is string => value !== null;
