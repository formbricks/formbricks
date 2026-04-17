import "server-only";
import { AIConfigurationError, generateText, isAiConfigured } from "@formbricks/ai";
import { logger } from "@formbricks/logger";
import { OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import { env } from "@/lib/env";
import { getOrganization } from "@/lib/organization/service";
import { getTranslate } from "@/lingodotdev/server";
import { getIsAIDataAnalysisEnabled, getIsAISmartToolsEnabled } from "@/modules/ee/license-check/lib/utils";

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

export const assertOrganizationAIConfigured = async (
  organizationId: string,
  capability: "smartTools" | "dataAnalysis"
): Promise<TOrganizationAIConfig> => {
  const t = await getTranslate();
  const aiConfig = await getOrganizationAIConfig(organizationId);
  const isCapabilityEntitled =
    capability === "smartTools" ? aiConfig.isAISmartToolsEntitled : aiConfig.isAIDataAnalysisEntitled;

  if (!isCapabilityEntitled) {
    throw new OperationNotAllowedError(
      t("environments.settings.general.ai_features_not_enabled_for_organization")
    );
  }

  if (capability === "smartTools" && !aiConfig.isAISmartToolsEnabled) {
    throw new OperationNotAllowedError(
      t("environments.settings.general.ai_smart_tools_disabled_for_organization")
    );
  }

  if (capability === "dataAnalysis" && !aiConfig.isAIDataAnalysisEnabled) {
    throw new OperationNotAllowedError(
      t("environments.settings.general.ai_data_analysis_disabled_for_organization")
    );
  }

  if (!aiConfig.isInstanceConfigured) {
    throw new OperationNotAllowedError(t("environments.settings.general.ai_instance_not_configured"));
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
