import "server-only";
import {
  AIConfigurationError,
  type TGenerateObjectOptions,
  type TGenerateObjectResult,
  generateObject,
  generateText,
  isAiConfigured,
} from "@formbricks/ai";
import { logger } from "@formbricks/logger";
import { OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import { env } from "@/lib/env";
import { getOrganization } from "@/lib/organization/service";
import { getIsAISmartToolsEnabled } from "@/modules/ee/license-check/lib/utils";

export const AI_ERROR_CODES = {
  FEATURES_NOT_ENABLED: "ai_features_not_enabled",
  SMART_TOOLS_DISABLED: "ai_smart_tools_disabled",
  INSTANCE_NOT_CONFIGURED: "ai_instance_not_configured",
} as const;

export type TAIErrorCode = (typeof AI_ERROR_CODES)[keyof typeof AI_ERROR_CODES];

export interface TOrganizationAIConfig {
  organizationId: string;
  isAISmartToolsEnabled: boolean;
  isAISmartToolsEntitled: boolean;
  isInstanceConfigured: boolean;
}

export const isInstanceAIConfigured = (): boolean => isAiConfigured(env);

export const getOrganizationAIConfig = async (organizationId: string): Promise<TOrganizationAIConfig> => {
  const organization = await getOrganization(organizationId);

  if (!organization) {
    throw new ResourceNotFoundError("Organization", organizationId);
  }

  const isAISmartToolsEntitled = await getIsAISmartToolsEnabled(organizationId);

  return {
    organizationId,
    isAISmartToolsEnabled: organization.isAISmartToolsEnabled,
    isAISmartToolsEntitled,
    isInstanceConfigured: isInstanceAIConfigured(),
  };
};

export type TAIUnavailableReason = "not_in_plan" | "not_enabled" | "instance_not_configured";

export const getAISmartToolsUnavailableReason = (
  aiConfig: TOrganizationAIConfig
): TAIUnavailableReason | undefined => {
  if (!aiConfig.isAISmartToolsEntitled) return "not_in_plan";
  if (!aiConfig.isAISmartToolsEnabled) return "not_enabled";
  if (!aiConfig.isInstanceConfigured) return "instance_not_configured";
  return undefined;
};

export const assertOrganizationAIConfigured = async (
  organizationId: string
): Promise<TOrganizationAIConfig> => {
  const aiConfig = await getOrganizationAIConfig(organizationId);

  if (!aiConfig.isAISmartToolsEntitled) {
    throw new OperationNotAllowedError(AI_ERROR_CODES.FEATURES_NOT_ENABLED);
  }

  if (!aiConfig.isAISmartToolsEnabled) {
    throw new OperationNotAllowedError(AI_ERROR_CODES.SMART_TOOLS_DISABLED);
  }

  if (!aiConfig.isInstanceConfigured) {
    throw new OperationNotAllowedError(AI_ERROR_CODES.INSTANCE_NOT_CONFIGURED);
  }

  return aiConfig;
};

type TGenerateOrganizationAITextInput = {
  organizationId: string;
} & Parameters<typeof generateText>[0];

export const generateOrganizationAIText = async ({
  organizationId,
  ...options
}: TGenerateOrganizationAITextInput): Promise<Awaited<ReturnType<typeof generateText>>> => {
  const aiConfig = await assertOrganizationAIConfigured(organizationId);

  try {
    return await generateText(options, env);
  } catch (error) {
    logger.error(
      {
        organizationId,
        isInstanceConfigured: aiConfig.isInstanceConfigured,
        errorCode: error instanceof AIConfigurationError ? error.code : undefined,
        err: error,
      },
      "Failed to generate organization AI text"
    );
    throw error;
  }
};

type TGenerateOrganizationAIObjectInput<T = unknown> = {
  organizationId: string;
} & TGenerateObjectOptions<T>;

export const generateOrganizationAIObject = async <T = unknown>({
  organizationId,
  ...options
}: TGenerateOrganizationAIObjectInput<T>): Promise<TGenerateObjectResult<T>> => {
  const aiConfig = await assertOrganizationAIConfigured(organizationId);

  try {
    return await generateObject<T>(options, env);
  } catch (error) {
    logger.error(
      {
        organizationId,
        isInstanceConfigured: aiConfig.isInstanceConfigured,
        errorCode: error instanceof AIConfigurationError ? error.code : undefined,
        err: error,
      },
      "Failed to generate organization AI object"
    );
    throw error;
  }
};
