import "server-only";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import type { TOrganizationRole } from "@formbricks/types/memberships";
import { DEFAULT_ORGANIZATION_ID, DEFAULT_ORGANIZATION_ROLE, IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { createOrganization } from "@/lib/organization/service";
import { ensureCloudStripeSetupForOrganization } from "@/modules/ee/billing/lib/organization-billing";

/** Role a new SSO member gets in an organization that already existed. Legacy default (PR #5046). */
const FALLBACK_EXISTING_ORGANIZATION_ROLE: TOrganizationRole = "manager";

export type TDefaultOrganizationAssignment = Readonly<{
  organizationId: string;
  role: TOrganizationRole;
}>;

/**
 * Find-or-create the organization named by `DEFAULT_ORGANIZATION_ID` and resolve the role its new SSO
 * member should get, restoring the pre-v5 behavior that the NextAuth→Better Auth migration dropped
 * (ENG-2089; the env var was last honored by `sso-handlers.ts` before PR #5046 replaced it with
 * `AUTH_SSO_DEFAULT_TEAM_ID`).
 *
 * Role, unchanged from the legacy handler: the sign-up that *creates* the organization gets `owner`,
 * so the first user through can administer it; every later sign-up gets `DEFAULT_ORGANIZATION_ROLE`,
 * defaulting to `manager`.
 *
 * Returns `null` when there is nothing to assign to — no env var, or creation failed. Callers treat
 * that as "provision the user without an organization" rather than as a sign-in failure: this runs
 * post-commit, after Better Auth has already created the user (see `provisionSsoUserMemberships`).
 *
 * An organization created here has no workspace: the agent creates the first one during setup. On
 * Cloud it also gets Stripe setup.
 */
export const ensureDefaultOrganization = async (
  userName: string
): Promise<TDefaultOrganizationAssignment | null> => {
  const defaultOrganizationId = DEFAULT_ORGANIZATION_ID;
  if (!defaultOrganizationId) return null;

  // Read through prisma rather than the reactCache'd `getOrganization`: this is called from a retried
  // post-commit path, where a cached miss from the previous attempt would send us into a second create
  // and a guaranteed unique-constraint failure.
  const findExisting = async (): Promise<TDefaultOrganizationAssignment | null> => {
    const existing = await prisma.organization.findUnique({
      where: { id: defaultOrganizationId },
      select: { id: true },
    });
    if (!existing) return null;
    return {
      organizationId: existing.id,
      role: DEFAULT_ORGANIZATION_ROLE ?? FALLBACK_EXISTING_ORGANIZATION_ROLE,
    };
  };

  try {
    const existing = await findExisting();
    if (existing) return existing;

    const organization = await createOrganization({
      id: defaultOrganizationId,
      name: `${userName}'s Organization`,
    });

    if (IS_FORMBRICKS_CLOUD) {
      ensureCloudStripeSetupForOrganization(organization.id).catch((error) => {
        logger.error(
          { error, organizationId: organization.id },
          "Stripe setup failed after default organization creation"
        );
      });
    }

    return { organizationId: organization.id, role: "owner" };
  } catch (error) {
    // Never throw from here: this runs post-commit, after Better Auth has created the user, so a
    // throw would surface as a mid-sign-in error without undoing anything.
    // The create failed — most realistically a concurrent first sign-up won the
    // race. Re-read once so that case still assigns, and give up on the assignment if not.
    const raced = await findExisting().catch(() => null);
    if (raced) return raced;

    logger.error(
      error,
      `Failed to resolve DEFAULT_ORGANIZATION_ID "${defaultOrganizationId}" for a new SSO user; the user was created without an organization`
    );
    return null;
  }
};
