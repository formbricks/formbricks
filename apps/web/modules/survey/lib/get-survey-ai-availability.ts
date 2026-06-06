import "server-only";
import {
  type TAIUnavailableReason,
  getAISmartToolsUnavailableReason,
  getOrganizationAIConfig,
} from "@/lib/ai/service";

export type TSurveyAIAvailability = {
  isAIAvailable: boolean;
  aiUnavailableReason?: TAIUnavailableReason;
};

type TSurveyAIAvailabilityOptions = {
  isReadOnly?: boolean;
  isAISmartToolsEnabled?: boolean;
  isAISmartToolsEntitled?: boolean;
};

export const getSurveyAIAvailability = async (
  organizationId: string,
  options?: TSurveyAIAvailabilityOptions
): Promise<TSurveyAIAvailability> => {
  if (options?.isReadOnly) {
    return { isAIAvailable: false, aiUnavailableReason: "read_only" };
  }

  const aiConfig = await getOrganizationAIConfig(organizationId);
  const resolvedConfig = {
    ...aiConfig,
    ...(options?.isAISmartToolsEnabled !== undefined
      ? { isAISmartToolsEnabled: options.isAISmartToolsEnabled }
      : {}),
    ...(options?.isAISmartToolsEntitled !== undefined
      ? { isAISmartToolsEntitled: options.isAISmartToolsEntitled }
      : {}),
  };
  const aiUnavailableReason = getAISmartToolsUnavailableReason(resolvedConfig);

  return {
    isAIAvailable: !aiUnavailableReason,
    aiUnavailableReason,
  };
};
