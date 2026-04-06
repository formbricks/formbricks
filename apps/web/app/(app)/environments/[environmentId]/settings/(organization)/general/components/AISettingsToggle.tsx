"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { TOrganization } from "@formbricks/types/organizations";
import { updateOrganizationAISettingsAction } from "@/app/(app)/environments/[environmentId]/settings/(organization)/general/actions";
import { getDisplayedOrganizationAISettingValue, getOrganizationAIEnablementState } from "@/lib/ai/utils";
import { getAccessFlags } from "@/lib/membership/utils";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { AdvancedOptionToggle } from "@/modules/ui/components/advanced-option-toggle";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";

interface AISettingsToggleProps {
  organization: TOrganization;
  membershipRole?: TOrganizationRole;
  isInstanceAIConfigured: boolean;
}

export const AISettingsToggle = ({
  organization,
  membershipRole,
  isInstanceAIConfigured,
}: Readonly<AISettingsToggleProps>) => {
  const [loadingField, setLoadingField] = useState<string | null>(null);
  const { t } = useTranslation();
  const router = useRouter();

  const { isOwner, isManager } = getAccessFlags(membershipRole);
  const canEdit = isOwner || isManager;
  const aiEnablementState = getOrganizationAIEnablementState({
    isInstanceConfigured: isInstanceAIConfigured,
  });
  const showInstanceConfigWarning = aiEnablementState.blockReason === "instanceNotConfigured";
  const isToggleDisabled = loadingField !== null || !canEdit || !aiEnablementState.canEnableFeatures;
  const aiEnablementBlockedMessage = t("environments.settings.general.ai_instance_not_configured");
  const displayedSmartToolsValue = getDisplayedOrganizationAISettingValue({
    currentValue: organization.isAISmartToolsEnabled,
    isInstanceConfigured: isInstanceAIConfigured,
  });
  const displayedDataAnalysisValue = getDisplayedOrganizationAISettingValue({
    currentValue: organization.isAIDataAnalysisEnabled,
    isInstanceConfigured: isInstanceAIConfigured,
  });

  const handleToggle = async (
    field: "isAISmartToolsEnabled" | "isAIDataAnalysisEnabled",
    checked: boolean
  ) => {
    if (checked && !aiEnablementState.canEnableFeatures) {
      toast.error(aiEnablementBlockedMessage);
      return;
    }

    setLoadingField(field);
    try {
      const data =
        field === "isAISmartToolsEnabled"
          ? { isAISmartToolsEnabled: checked }
          : { isAIDataAnalysisEnabled: checked };
      const response = await updateOrganizationAISettingsAction({
        organizationId: organization.id,
        data,
      });

      if (response?.data) {
        toast.success(t("environments.settings.general.ai_settings_updated_successfully"));
        router.refresh();
      } else {
        toast.error(getFormattedErrorMessage(response));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.something_went_wrong_please_try_again"));
    } finally {
      setLoadingField(null);
    }
  };

  return (
    <div className="space-y-4">
      {showInstanceConfigWarning && (
        <Alert variant="warning">
          <AlertDescription>{aiEnablementBlockedMessage}</AlertDescription>
        </Alert>
      )}

      <AdvancedOptionToggle
        isChecked={displayedSmartToolsValue}
        onToggle={(checked) => handleToggle("isAISmartToolsEnabled", checked)}
        htmlId="ai-smart-tools-toggle"
        title={t("environments.settings.general.ai_smart_tools_enabled")}
        description={t("environments.settings.general.ai_smart_tools_enabled_description")}
        disabled={isToggleDisabled}
        customContainerClass="px-0"
      />

      <AdvancedOptionToggle
        isChecked={displayedDataAnalysisValue}
        onToggle={(checked) => handleToggle("isAIDataAnalysisEnabled", checked)}
        htmlId="ai-data-analysis-toggle"
        title={t("environments.settings.general.ai_data_analysis_enabled")}
        description={t("environments.settings.general.ai_data_analysis_enabled_description")}
        disabled={isToggleDisabled}
        customContainerClass="px-0"
      />

      {!canEdit && (
        <Alert variant="warning">
          <AlertDescription>
            {t("common.only_owners_managers_and_manage_access_members_can_perform_this_action")}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
