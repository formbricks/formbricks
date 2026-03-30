import "server-only";
import { cache as reactCache } from "react";
import {
  AIConfigurationError,
  type AIConfigurationStatus,
  type AIEnvironment,
  type ActiveAIProvider,
  getActiveAiModel,
  getActiveAiProvider,
  getAiConfigurationStatus,
  getAiModel,
} from "@formbricks/ai";
import { logger } from "@formbricks/logger";
import { OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import { env } from "@/lib/env";
import { getOrganization } from "@/lib/organization/service";
import { getTranslate } from "@/lingodotdev/server";
import { getIsAIDataAnalysisEnabled, getIsAISmartToolsEnabled } from "@/modules/ee/license-check/lib/utils";

export interface TOrganizationAIConfig {
  organizationId: string;
  activeProvider: ActiveAIProvider | null;
  activeModel: string | null;
  isAISmartToolsEnabled: boolean;
  isAIDataAnalysisEnabled: boolean;
  isAISmartToolsEntitled: boolean;
  isAIDataAnalysisEntitled: boolean;
  configStatus: AIConfigurationStatus;
  isInstanceConfigured: boolean;
}

const getResolvedAIEnvironment = reactCache(
  (): AIEnvironment => ({
    AI_PROVIDER: env.AI_PROVIDER,
    AI_MODEL: env.AI_MODEL,
    AI_GCP_PROJECT: env.AI_GCP_PROJECT,
    AI_GCP_LOCATION: env.AI_GCP_LOCATION,
    AI_GCP_CREDENTIALS_JSON: env.AI_GCP_CREDENTIALS_JSON,
    AI_GCP_APPLICATION_CREDENTIALS: env.AI_GCP_APPLICATION_CREDENTIALS,
    AI_AWS_REGION: env.AI_AWS_REGION,
    AI_AWS_ACCESS_KEY_ID: env.AI_AWS_ACCESS_KEY_ID,
    AI_AWS_SECRET_ACCESS_KEY: env.AI_AWS_SECRET_ACCESS_KEY,
    AI_AWS_SESSION_TOKEN: env.AI_AWS_SESSION_TOKEN,
    AI_AZURE_BASE_URL: env.AI_AZURE_BASE_URL,
    AI_AZURE_RESOURCE_NAME: env.AI_AZURE_RESOURCE_NAME,
    AI_AZURE_API_KEY: env.AI_AZURE_API_KEY,
    AI_AZURE_API_VERSION: env.AI_AZURE_API_VERSION,
  })
);

export const getActiveInstanceAIProvider = reactCache(() => getActiveAiProvider(getResolvedAIEnvironment()));

export const getActiveInstanceAIModel = reactCache(() => getActiveAiModel(getResolvedAIEnvironment()));

export const getInstanceAIConfigStatus = reactCache(
  (): AIConfigurationStatus => getAiConfigurationStatus(getResolvedAIEnvironment())
);

export const getOrganizationAIConfig = reactCache(
  async (organizationId: string): Promise<TOrganizationAIConfig> => {
    const organization = await getOrganization(organizationId);

    if (!organization) {
      throw new ResourceNotFoundError("Organization", organizationId);
    }

    const configStatus = getInstanceAIConfigStatus();
    const activeProvider = getActiveInstanceAIProvider();
    const activeModel = getActiveInstanceAIModel();
    const [isAISmartToolsEntitled, isAIDataAnalysisEntitled] = await Promise.all([
      getIsAISmartToolsEnabled(organizationId),
      getIsAIDataAnalysisEnabled(organizationId),
    ]);

    return {
      organizationId,
      activeProvider,
      activeModel,
      isAISmartToolsEnabled: organization.isAISmartToolsEnabled,
      isAIDataAnalysisEnabled: organization.isAIDataAnalysisEnabled,
      isAISmartToolsEntitled,
      isAIDataAnalysisEntitled,
      configStatus,
      isInstanceConfigured: configStatus.isConfigured,
    };
  }
);

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

export const getOrganizationAILanguageModel = async (
  organizationId: string,
  capability: "smartTools" | "dataAnalysis"
) => {
  const aiConfig = await assertOrganizationAIConfigured(organizationId, capability);

  try {
    return getAiModel(getResolvedAIEnvironment());
  } catch (error) {
    logger.error(
      {
        organizationId,
        capability,
        provider: aiConfig.activeProvider,
        model: aiConfig.activeModel,
        missingFields: aiConfig.configStatus.missingFields,
        invalidFields: aiConfig.configStatus.invalidFields,
        errorCode: error instanceof AIConfigurationError ? error.code : undefined,
        err: error,
      },
      "Failed to resolve organization AI language model"
    );
    throw error;
  }
};
