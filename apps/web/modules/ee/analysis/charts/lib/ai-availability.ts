export type TAIUnavailableReason = "not_in_plan" | "not_enabled" | "instance_not_configured";
export type TAIUnavailableMessageKey =
  | "workspace.analysis.charts.ai_not_in_plan"
  | "workspace.analysis.charts.ai_not_enabled"
  | "workspace.analysis.charts.ai_instance_not_configured"
  | "workspace.analysis.charts.ai_not_available";
export type TAIUnavailableActionLabelKey =
  | "workspace.analysis.charts.ai_enable_in_settings"
  | "workspace.analysis.charts.ai_upgrade_plan";

interface AIUnavailableAction {
  href: string;
  labelKey: TAIUnavailableActionLabelKey;
}

export const AI_UNAVAILABLE_MESSAGE_KEYS: Record<
  TAIUnavailableReason,
  Exclude<TAIUnavailableMessageKey, "workspace.analysis.charts.ai_not_available">
> = {
  not_in_plan: "workspace.analysis.charts.ai_not_in_plan",
  not_enabled: "workspace.analysis.charts.ai_not_enabled",
  instance_not_configured: "workspace.analysis.charts.ai_instance_not_configured",
};

export const getAIUnavailableMessageKey = (reason?: TAIUnavailableReason): TAIUnavailableMessageKey => {
  if (!reason) {
    return "workspace.analysis.charts.ai_not_available";
  }

  return AI_UNAVAILABLE_MESSAGE_KEYS[reason];
};

export const getAIUnavailableAction = (
  reason: TAIUnavailableReason | undefined,
  workspaceId: string
): AIUnavailableAction | undefined => {
  if (reason === "not_enabled") {
    return {
      href: `/workspaces/${workspaceId}/settings/organization/general`,
      labelKey: "workspace.analysis.charts.ai_enable_in_settings",
    };
  }

  if (reason === "not_in_plan") {
    return {
      href: `/workspaces/${workspaceId}/settings/organization/billing`,
      labelKey: "workspace.analysis.charts.ai_upgrade_plan",
    };
  }

  return undefined;
};
