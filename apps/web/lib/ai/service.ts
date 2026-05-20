import "server-only";
import { AIConfigurationError, generateText, isAiConfigured } from "@formbricks/ai";
import { logger } from "@formbricks/logger";
import { OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import { env } from "@/lib/env";
import { getOrganization } from "@/lib/organization/service";
import { getIsAIDataAnalysisEnabled, getIsAISmartToolsEnabled } from "@/modules/ee/license-check/lib/utils";

export const AI_ERROR_CODES = {
  FEATURES_NOT_ENABLED: "ai_features_not_enabled",
  SMART_TOOLS_DISABLED: "ai_smart_tools_disabled",
  DATA_ANALYSIS_DISABLED: "ai_data_analysis_disabled",
  INSTANCE_NOT_CONFIGURED: "ai_instance_not_configured",
} as const;

export type TAIErrorCode = (typeof AI_ERROR_CODES)[keyof typeof AI_ERROR_CODES];

export interface TOrganizationAIConfig {
  organizationId: string;
  isAISmartToolsEnabled: boolean;
  isAIDataAnalysisEnabled: boolean;
  isAISmartToolsEntitled: boolean;
  isAIDataAnalysisEntitled: boolean;
  isInstanceConfigured: boolean;
}

export const isInstanceAIConfigured = (): boolean => isAiConfigured(env);

export const getOrganizationAIConfig = async (organizationId: string): Promise<TOrganizationAIConfig> => {
  const organization = await getOrganization(organizationId);

  if (!organization) {
    throw new ResourceNotFoundError("Organization", organizationId);
  }

  const [isAISmartToolsEntitled, isAIDataAnalysisEntitled] = await Promise.all([
    getIsAISmartToolsEnabled(organizationId),
    getIsAIDataAnalysisEnabled(organizationId),
  ]);

  return {
    organizationId,
    isAISmartToolsEnabled: organization.isAISmartToolsEnabled,
    isAIDataAnalysisEnabled: organization.isAIDataAnalysisEnabled,
    isAISmartToolsEntitled,
    isAIDataAnalysisEntitled,
    isInstanceConfigured: isInstanceAIConfigured(),
  };
};

export type TAIUnavailableReason = "not_in_plan" | "not_enabled" | "instance_not_configured";

export const getAIDataAnalysisUnavailableReason = (
  aiConfig: TOrganizationAIConfig
): TAIUnavailableReason | undefined => {
  if (!aiConfig.isAIDataAnalysisEntitled) return "not_in_plan";
  if (!aiConfig.isAIDataAnalysisEnabled) return "not_enabled";
  if (!aiConfig.isInstanceConfigured) return "instance_not_configured";
  return undefined;
};

export const getAISmartToolsUnavailableReason = (
  aiConfig: TOrganizationAIConfig
): TAIUnavailableReason | undefined => {
  if (!aiConfig.isAISmartToolsEntitled) return "not_in_plan";
  if (!aiConfig.isAISmartToolsEnabled) return "not_enabled";
  if (!aiConfig.isInstanceConfigured) return "instance_not_configured";
  return undefined;
};

export const assertOrganizationAIConfigured = async (
  organizationId: string,
  capability: "smartTools" | "dataAnalysis"
): Promise<TOrganizationAIConfig> => {
  const aiConfig = await getOrganizationAIConfig(organizationId);
  const isCapabilityEntitled =
    capability === "smartTools" ? aiConfig.isAISmartToolsEntitled : aiConfig.isAIDataAnalysisEntitled;

  if (!isCapabilityEntitled) {
    throw new OperationNotAllowedError(AI_ERROR_CODES.FEATURES_NOT_ENABLED);
  }

  if (capability === "smartTools" && !aiConfig.isAISmartToolsEnabled) {
    throw new OperationNotAllowedError(AI_ERROR_CODES.SMART_TOOLS_DISABLED);
  }

  if (capability === "dataAnalysis" && !aiConfig.isAIDataAnalysisEnabled) {
    throw new OperationNotAllowedError(AI_ERROR_CODES.DATA_ANALYSIS_DISABLED);
  }

  if (!aiConfig.isInstanceConfigured) {
    throw new OperationNotAllowedError(AI_ERROR_CODES.INSTANCE_NOT_CONFIGURED);
  }

  return aiConfig;
};

type TGenerateOrganizationAITextInput = {
  organizationId: string;
  capability: "smartTools" | "dataAnalysis";
} & Parameters<typeof generateText>[0];

export const generateOrganizationAIText = async ({
  organizationId,
  capability,
  ...options
}: TGenerateOrganizationAITextInput): Promise<Awaited<ReturnType<typeof generateText>>> => {
  const aiConfig = await assertOrganizationAIConfigured(organizationId, capability);

  try {
    return await generateText(options, env);
  } catch (error) {
    logger.error(
      {
        organizationId,
        capability,
        isInstanceConfigured: aiConfig.isInstanceConfigured,
        errorCode: error instanceof AIConfigurationError ? error.code : undefined,
        err: error,
      },
      "Failed to generate organization AI text"
    );
    throw error;
  }
};
