import "server-only";
import { prisma } from "@formbricks/database";
import { normalizeEmailForComparison } from "@/lib/utils/email";

/**
 * The user an email from a survey or workflow is rate-limited by (ENG-3823): its owner, set by the server
 * from the signed-in user who created it (`ownerId` for surveys, `createdBy` for workflows).
 *
 * Created with an API key, it has no owner. Charging nobody would let one account reset its budget by
 * opening fresh organizations with fresh API keys, so the organization's owner is charged instead (the
 * same one every time when there are several).
 */
export const resolveEmailActorUserId = async (
  ownerUserId: string | null,
  organizationId: string
): Promise<string | null> => {
  if (ownerUserId) {
    return ownerUserId;
  }
  const owner = await prisma.membership.findFirst({
    where: { organizationId, role: "owner" },
    orderBy: { userId: "asc" },
    select: { userId: true },
  });
  return owner?.userId ?? null;
};

/**
 * The members among `emails`, in one query. The membership answer depends only on the address and the
 * organization, so a caller that classifies several addresses (one per follow-up, per response) resolves
 * them together instead of once each. Returns normalized addresses.
 */
export const getOrganizationMemberEmails = async (
  organizationId: string,
  emails: readonly string[]
): Promise<Set<string>> => {
  const normalized = [...new Set(emails.map(normalizeEmailForComparison))];
  if (normalized.length === 0) {
    return new Set();
  }
  const members = await prisma.membership.findMany({
    where: { organizationId, user: { email: { in: normalized } } },
    select: { user: { select: { email: true } } },
  });
  return new Set(members.map((membership) => membership.user.email));
};
