import "server-only";
import { logger } from "@formbricks/logger";
import type { TUserNotificationSettings } from "@formbricks/types/user";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { createMembership } from "@/lib/membership/service";
import { createOrganization } from "@/lib/organization/service";
import { capturePostHogEvent, getEmailDomain, groupIdentifyPostHog } from "@/lib/posthog";
import { updateUser } from "@/modules/auth/lib/user";
import { ensureCloudStripeSetupForOrganization } from "@/modules/ee/billing/lib/organization-billing";

/**
 * First-login provisioning for a self-signed-up account: one organization the person owns, and no
 * workspace. The agent creates the first workspace during setup (`create_workspace`), so an
 * organization with zero workspaces is the normal state right after sign-up.
 *
 * Shared by credentials sign-up and SSO just-in-time provisioning, which must not drift apart. Invited
 * members never come through here: they join the inviter's organization.
 */
export const createOwnedOrganization = async (user: {
  id: string;
  name: string;
  email: string;
  notificationSettings?: TUserNotificationSettings;
}) => {
  const organization = await createOrganization({ name: `${user.name}'s Organization` });

  await createMembership(organization.id, user.id, {
    role: "owner",
    accepted: true,
  });

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
    email_domain: getEmailDomain(user.email),
  });

  capturePostHogEvent(
    user.id,
    "organization_created",
    {
      organization_id: organization.id,
      is_first_org: true,
    },
    { organizationId: organization.id }
  );

  await updateUser(user.id, {
    notificationSettings: {
      ...user.notificationSettings,
      alert: { ...user.notificationSettings?.alert },

      unsubscribedOrganizationIds: Array.from(
        new Set([...(user.notificationSettings?.unsubscribedOrganizationIds ?? []), organization.id])
      ),
    },
  });

  return organization;
};
