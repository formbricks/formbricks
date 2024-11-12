import { TOrganization } from "@formbricks/types/organizations";
import { IS_AI_CONFIGURED, IS_FORMBRICKS_CLOUD } from "../constants";

export const getPromptText = (questionHeadline: string, response: string) => {
  return `**${questionHeadline.trim()}**\n${response.trim()}`;
};

export const getIsAIEnabled = async (organization: TOrganization) => {
  // This is a temporary workaround to enable AI without checking the ee license validity, as the ee package is not available in the lib package.(but the billing plan check suffices the license check).
  const billingPlan = organization.billing.plan;
  return Boolean(
    organization.isAIEnabled &&
      IS_AI_CONFIGURED &&
      IS_FORMBRICKS_CLOUD &&
      (billingPlan === "startup" || billingPlan === "scale" || billingPlan === "enterprise")
  );
};
