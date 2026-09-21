import type { TAIUnavailableReason } from "@/lib/ai/service";
import { organizationSettingsPath } from "@/modules/settings/lib/routes";

/**
 * Only plain key lookups are needed here, so the narrowest translate signature does — which lets a
 * server-side caller pass its own translator and a test pass an identity function.
 */
type TTranslate = (key: string) => string;

export type TAIUnavailableActionType = "enable_ai" | "upgrade_plan" | "request_license";

export type TAIUnavailableAction = {
  href: string;
  type: TAIUnavailableActionType;
  /** Self-hosted upgrades leave the app for the licence request form; the other targets are in-app. */
  isExternal: boolean;
};

/**
 * The deployment facts the upgrade target depends on. `IS_FORMBRICKS_CLOUD` and the licence request
 * URL live in the server-only `lib/constants`, so client components read them from the workspace
 * context (`useDeploymentInfo`) instead, which the server layouts fill in.
 */
export type TDeploymentInfo = {
  isFormbricksCloud: boolean;
  enterpriseLicenseRequestFormUrl: string;
};

export const getAIUnavailableAction = (
  reason: TAIUnavailableReason | undefined,
  organizationId: string,
  deployment: TDeploymentInfo
): TAIUnavailableAction | undefined => {
  if (reason === "not_enabled") {
    return {
      href: organizationSettingsPath(organizationId, "general"),
      type: "enable_ai",
      isExternal: false,
    };
  }

  if (reason === "not_in_plan") {
    // Same split every other gated feature uses (see the UpgradePrompt call sites): cloud sends
    // people to billing, self-hosted to the enterprise licence request form.
    return deployment.isFormbricksCloud
      ? {
          href: organizationSettingsPath(organizationId, "billing"),
          type: "upgrade_plan",
          isExternal: false,
        }
      : {
          href: deployment.enterpriseLicenseRequestFormUrl,
          type: "request_license",
          isExternal: true,
        };
  }

  // `instance_not_configured` is an operator's job and `read_only` a permission the user cannot
  // grant themselves, so neither offers a self-service action.
  return undefined;
};

/**
 * The one wording for "AI is unavailable", shared by every surface that gates on AI. Takes `t`
 * rather than returning a key so the keys stay visible to `pnpm i18n`'s scanner.
 */
export const getAIUnavailableMessage = (reason: TAIUnavailableReason | undefined, t: TTranslate): string => {
  switch (reason) {
    case "not_in_plan":
      return t("common.ai_unavailable.not_in_plan");
    case "not_enabled":
      return t("common.ai_unavailable.not_enabled");
    case "instance_not_configured":
      return t("common.ai_unavailable.instance_not_configured");
    case "read_only":
      return t("common.ai_unavailable.read_only");
    default:
      return t("common.ai_unavailable.unknown");
  }
};

/**
 * The server error codes that also mean "AI is unavailable". They surface when entitlement, the
 * organization toggle or the instance config changes between page load and submit, so they carry the
 * same reasons the page-load gate does and resolve to the same copy.
 */
const AI_UNAVAILABLE_ERROR_CODE_REASONS = {
  ai_features_not_enabled: "not_in_plan",
  ai_smart_tools_disabled: "not_enabled",
  ai_instance_not_configured: "instance_not_configured",
} as const satisfies Record<string, TAIUnavailableReason>;

/**
 * Undefined for any other code — including a missing one — so callers keep their own feature-specific
 * error handling.
 */
export const getAIUnavailableMessageForErrorCode = (
  errorCode: string | undefined,
  t: TTranslate
): string | undefined => {
  if (!errorCode) return undefined;
  const reason =
    AI_UNAVAILABLE_ERROR_CODE_REASONS[errorCode as keyof typeof AI_UNAVAILABLE_ERROR_CODE_REASONS];
  return reason ? getAIUnavailableMessage(reason, t) : undefined;
};

export const getAIUnavailableActionLabel = (type: TAIUnavailableActionType, t: TTranslate): string => {
  switch (type) {
    case "enable_ai":
      return t("common.ai_unavailable.enable_in_settings");
    case "upgrade_plan":
      return t("common.upgrade_plan");
    case "request_license":
      return t("common.request_trial_license");
  }
};
