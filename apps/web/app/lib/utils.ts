import { getEnterpriseLicense } from "@/modules/ee/license-check/lib/utils";
import { IS_AI_CONFIGURED, IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { TInvite } from "@formbricks/types/invites";
import { TOrganization, TOrganizationBillingPlan } from "@formbricks/types/organizations";

export const isInviteExpired = (invite: TInvite) => {
  const now = new Date();
  const expiresAt = new Date(invite.expiresAt);
  return now > expiresAt;
};

export const getIsOrganizationAIReady = async (billingPlan: TOrganizationBillingPlan) => {
  const { active: isEnterpriseEdition } = await getEnterpriseLicense();

  // TODO: We'll remove the IS_FORMBRICKS_CLOUD check once we have the AI feature available for self-hosted customers
  return Boolean(
    IS_FORMBRICKS_CLOUD &&
      IS_AI_CONFIGURED &&
      isEnterpriseEdition &&
      (billingPlan === "startup" || billingPlan === "scale" || billingPlan === "enterprise")
  );
};

export const getIsAIEnabled = async (organization: TOrganization) => {
  const isOrganizationAIReady = await getIsOrganizationAIReady(organization.billing.plan);
  return Boolean(isOrganizationAIReady && organization.isAIEnabled);
};
