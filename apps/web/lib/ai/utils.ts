export type TAIEnablementBlockReason = "instanceNotConfigured";

interface TOrganizationAIEnablementState {
  canEnableFeatures: boolean;
  blockReason?: TAIEnablementBlockReason;
}

export const getDisplayedOrganizationAISettingValue = ({
  currentValue,
  isInstanceConfigured,
}: {
  currentValue: boolean;
  isInstanceConfigured: boolean;
}): boolean => isInstanceConfigured && currentValue;

export const getOrganizationAIEnablementState = ({
  isInstanceConfigured,
}: {
  isInstanceConfigured: boolean;
}): TOrganizationAIEnablementState => {
  if (!isInstanceConfigured) {
    return {
      canEnableFeatures: false,
      blockReason: "instanceNotConfigured",
    };
  }

  return {
    canEnableFeatures: true,
  };
};
