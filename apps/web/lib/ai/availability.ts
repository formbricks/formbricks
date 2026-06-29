import type { TAIUnavailableReason } from "@/lib/ai/service";
import { organizationSettingsPath } from "@/modules/settings/lib/routes";

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
    // NOTE: this helper runs in client components, so it can't read the server-only
    // IS_FORMBRICKS_CLOUD. The cloud-vs-enterprise upgrade target is therefore not resolved here;
    // billing is the cloud destination. Self-hosted enterprise routing needs the cloud flag threaded
    // in as a prop (follow-up).
    return {
      href: organizationSettingsPath(organizationId, "billing"),
      type: "upgrade_plan",
    };
  }

  return undefined;
};
