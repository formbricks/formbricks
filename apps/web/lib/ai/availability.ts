import type { TAIUnavailableReason } from "@/lib/ai/service";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getOrganizationBillingPath, organizationSettingsPath } from "@/modules/settings/lib/routes";

export type TAIUnavailableActionType = "enable_ai" | "upgrade_plan";

export type TAIUnavailableAction = {
  href: string;
  type: TAIUnavailableActionType;
};

export const getAIUnavailableAction = (
  reason: TAIUnavailableReason | undefined,
  organizationId: string
): TAIUnavailableAction | undefined => {
  if (reason === "not_enabled") {
    return {
      href: organizationSettingsPath(organizationId, "general"),
      type: "enable_ai",
    };
  }

  if (reason === "not_in_plan") {
    return {
      href: getOrganizationBillingPath(organizationId, IS_FORMBRICKS_CLOUD),
      type: "upgrade_plan",
    };
  }

  return undefined;
};
