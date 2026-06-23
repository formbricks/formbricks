import type { TAIUnavailableReason } from "@/lib/ai/service";

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
      href: `/organizations/${organizationId}/settings/general`,
      type: "enable_ai",
    };
  }

  if (reason === "not_in_plan") {
    return {
      href: `/organizations/${organizationId}/settings/billing`,
      type: "upgrade_plan",
    };
  }

  return undefined;
};
