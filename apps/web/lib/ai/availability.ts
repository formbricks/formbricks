import type { TAIUnavailableReason } from "@/lib/ai/service";

export type TAIUnavailableActionType = "enable_ai" | "upgrade_plan";

export type TAIUnavailableAction = {
  href: string;
  type: TAIUnavailableActionType;
};

export const getAIUnavailableAction = (
  reason: TAIUnavailableReason | undefined,
  workspaceId: string
): TAIUnavailableAction | undefined => {
  if (reason === "not_enabled") {
    return {
      href: `/workspaces/${workspaceId}/settings/organization/general`,
      type: "enable_ai",
    };
  }

  if (reason === "not_in_plan") {
    return {
      href: `/workspaces/${workspaceId}/settings/organization/billing`,
      type: "upgrade_plan",
    };
  }

  return undefined;
};
