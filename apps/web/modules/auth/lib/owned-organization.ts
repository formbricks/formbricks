import "server-only";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import type { TUserNotificationSettings } from "@formbricks/types/user";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { createMembership } from "@/lib/membership/service";
import { createOrganization } from "@/lib/organization/service";
import { capturePostHogEvent, getEmailDomain, groupIdentifyPostHog } from "@/lib/posthog";
import { updateUser } from "@/modules/auth/lib/user";
import { ensureCloudStripeSetupForOrganization } from "@/modules/ee/billing/lib/organization-billing";

type TOwnedOrganizationUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  notificationSettings?: TUserNotificationSettings;
};

type TOwnedOrganizationOptions = {
  /** Display name. Defaults to "<user name>'s Organization", the self sign-up name. */
  name?: string;
  /** Analytics only: whether this is the first organization on the instance (`is_first_org`). */
  isFirstOrganization: boolean;
  /**
   * Switch the person's notification emails for this organization off. Self sign-up does, because a brand
   * new account should not be mailed about an organization it has not set up yet; the person turns them on
   * in their settings. Needs `user.notificationSettings`, which a session user does not carry, so a caller
   * that only has a session passes `false`.
   */
  unsubscribeFromNotifications: boolean;
};

/**
 * The one place an organization is created for a person who becomes its owner, and no workspace with it:
 * the agent creates the first workspace during setup (`create_workspace`), so an organization with zero
 * workspaces is the normal state right after creation (ADR 0018).
 *
 * Shared by credentials sign-up, SSO just-in-time provisioning and `createV3Organization` (the
 * `create_organization` tool, `POST /api/v3/organizations` and the organization switcher), which must not
 * drift apart. Invited members never come through here: they join the inviter's organization.
 *
 * The organization and its owner membership are written by two services, so a failing membership would
 * leave an organization nobody can reach. It was created a moment ago and owns nothing, so it is removed
 * again and the original failure is what the caller sees.
 */
export const createOwnedOrganization = async (
  user: TOwnedOrganizationUser,
  { name, isFirstOrganization, unsubscribeFromNotifications }: Readonly<TOwnedOrganizationOptions>
) => {
  const organization = await createOrganization({ name: name ?? `${user.name}'s Organization` });

  try {
    await createMembership(organization.id, user.id, {
      role: "owner",
      accepted: true,
    });
  } catch (error) {
    await prisma.organization.delete({ where: { id: organization.id } }).catch((cleanupError) => {
      logger.error(
        { error: cleanupError, organizationId: organization.id },
        "Could not remove the ownerless organization after its membership failed"
      );
    });
    throw error;
  }

  // Stripe setup must run AFTER membership is created so the owner email is available
  if (IS_FORMBRICKS_CLOUD) {
    ensureCloudStripeSetupForOrganization(organization.id).catch((error) => {
      logger.error(
        { error, organizationId: organization.id },
        "Stripe setup failed after organization creation"
      );
    });
  }

  groupIdentifyPostHog("organization", organization.id, {
    name: organization.name,
    email_domain: user.email ? getEmailDomain(user.email) : undefined,
  });

  capturePostHogEvent(
    user.id,
    "organization_created",
    {
      organization_id: organization.id,
      is_first_org: isFirstOrganization,
    },
    { organizationId: organization.id }
  );

  if (unsubscribeFromNotifications) {
    await updateUser(user.id, {
      notificationSettings: {
        ...user.notificationSettings,
        alert: { ...user.notificationSettings?.alert },

        unsubscribedOrganizationIds: Array.from(
          new Set([...(user.notificationSettings?.unsubscribedOrganizationIds ?? []), organization.id])
        ),
      },
    });
  }

  return organization;
};
