export type TAIUnavailableReason = "not_in_plan" | "not_enabled" | "instance_not_configured" | "read_only";
export type TAIUnavailableActionType = "enable_ai" | "upgrade_plan";

interface AIUnavailableAction {
  href: string;
  type: TAIUnavailableActionType;
}

export const getAIUnavailableAction = (
  reason: TAIUnavailableReason | undefined,
  workspaceId: string
): AIUnavailableAction | undefined => {
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
