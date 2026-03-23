"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { TOrganization } from "@formbricks/types/organizations";
import { updateOrganizationAISettingsAction } from "@/app/(app)/environments/[environmentId]/settings/(organization)/general/actions";
import { getAccessFlags } from "@/lib/membership/utils";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { AdvancedOptionToggle } from "@/modules/ui/components/advanced-option-toggle";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";

interface AISettingsToggleProps {
  organization: TOrganization;
  membershipRole?: TOrganizationRole;
}

export const AISettingsToggle = ({ organization, membershipRole }: Readonly<AISettingsToggleProps>) => {
  const [loadingField, setLoadingField] = useState<string | null>(null);
  const { t } = useTranslation();
  const router = useRouter();

  const { isOwner, isManager } = getAccessFlags(membershipRole);
  const canEdit = isOwner || isManager;

  const handleToggle = async (
    field: "isAISmartToolsEnabled" | "isAIDataAnalysisEnabled",
    checked: boolean
  ) => {
    setLoadingField(field);
    try {
      const response = await updateOrganizationAISettingsAction({
        organizationId: organization.id,
        data: { [field]: checked },
      });

      if (response?.data) {
        toast.success(t("environments.settings.general.ai_settings_updated_successfully"));
        router.refresh();
      } else {
        const errorMessage = getFormattedErrorMessage(response);
        toast.error(errorMessage);
      }
    } catch {
      toast.error(t("common.something_went_wrong"));
    } finally {
      setLoadingField(null);
    }
  };

  return (
    <div>
      <AdvancedOptionToggle
        isChecked={organization.isAISmartToolsEnabled}
        onToggle={(checked) => handleToggle("isAISmartToolsEnabled", checked)}
        htmlId="ai-smart-tools-toggle"
        title={t("environments.settings.general.ai_smart_tools_enabled")}
        description={t("environments.settings.general.ai_smart_tools_enabled_description")}
        disabled={loadingField !== null || !canEdit}
        customContainerClass="px-0"
      />

      <AdvancedOptionToggle
        isChecked={organization.isAIDataAnalysisEnabled}
        onToggle={(checked) => handleToggle("isAIDataAnalysisEnabled", checked)}
        htmlId="ai-data-analysis-toggle"
        title={t("environments.settings.general.ai_data_analysis_enabled")}
        description={t("environments.settings.general.ai_data_analysis_enabled_description")}
        disabled={loadingField !== null || !canEdit}
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
