import "server-only";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import type { TOrganizationRole } from "@formbricks/types/memberships";
import { DEFAULT_ORGANIZATION_ID, DEFAULT_ORGANIZATION_ROLE, IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { createOrganization } from "@/lib/organization/service";
import { DEFAULT_WORKSPACE_NAME } from "@/lib/workspace/constants";
import { ensureCloudStripeSetupForOrganization } from "@/modules/ee/billing/lib/organization-billing";
import { createWorkspace } from "@/modules/workspaces/settings/lib/workspace";

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
 * Unlike the legacy handler, an organization created here also gets a workspace (and, on Cloud,
 * Stripe setup) — v5 requires one, so creating the bare organization would drop the user into an
 * unusable instance.
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

    await createWorkspace(organization.id, { name: DEFAULT_WORKSPACE_NAME });

    return { organizationId: organization.id, role: "owner" };
  } catch (error) {
    // Two realistic causes, both operator-facing rather than user-facing: `DEFAULT_ORGANIZATION_ID`
    // is not a cuid2 (ZOrganizationCreateInput rejects it), or a concurrent first sign-up won the
    // create. Re-read once so the concurrent case still assigns, and otherwise give up on the
    // assignment — never throw, or an already-created user would see a mid-sign-in error.
    const raced = await findExisting().catch(() => null);
    if (raced) return raced;

    logger.error(
      error,
      `Failed to resolve DEFAULT_ORGANIZATION_ID "${defaultOrganizationId}" for a new SSO user; the user was created without an organization`
    );
    return null;
  }
};
