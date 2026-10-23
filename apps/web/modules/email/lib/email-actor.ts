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
 * Whether an address belongs to a member of the organization. A follow-up author can type any address, so
 * one outside the organization is counted like a respondent's (`externalRecipient`).
 */
export const isOrganizationMemberEmail = async (organizationId: string, email: string): Promise<boolean> => {
  const membership = await prisma.membership.findFirst({
    // Better Auth stores addresses lowercased, the rule `normalizeEmailForComparison` matches.
    where: { organizationId, user: { email: normalizeEmailForComparison(email) } },
    select: { userId: true },
  });
  return membership !== null;
};
