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
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Label } from "@/modules/ui/components/label";
import { Switch } from "@/modules/ui/components/switch";

interface AISettingsToggleProps {
  organization: TOrganization;
  membershipRole?: TOrganizationRole;
}

export const AISettingsToggle = ({ organization, membershipRole }: Readonly<AISettingsToggleProps>) => {
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useTranslation();
  const router = useRouter();

  const { isOwner, isManager } = getAccessFlags(membershipRole);
  const canEdit = isOwner || isManager;

  const handleToggle = async (
    field: "isAISmartToolsEnabled" | "isAIDataAnalysisEnabled",
    checked: boolean
  ) => {
    setIsLoading(true);
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
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start space-x-2">
        <Switch
          id="ai-smart-tools-toggle"
          className="mt-0.5"
          checked={organization.isAISmartToolsEnabled}
          disabled={isLoading || !canEdit}
          onCheckedChange={(checked) => handleToggle("isAISmartToolsEnabled", checked)}
        />
        <div>
          <Label htmlFor="ai-smart-tools-toggle">
            {t("environments.settings.general.ai_smart_tools_enabled")}
          </Label>
          <p className="text-xs text-slate-500">
            {t("environments.settings.general.ai_smart_tools_enabled_description")}
          </p>
        </div>
      </div>

      <div className="flex items-start space-x-2">
        <Switch
          id="ai-data-analysis-toggle"
          className="mt-0.5"
          checked={organization.isAIDataAnalysisEnabled}
          disabled={isLoading || !canEdit}
          onCheckedChange={(checked) => handleToggle("isAIDataAnalysisEnabled", checked)}
        />
        <div>
          <Label htmlFor="ai-data-analysis-toggle">
            {t("environments.settings.general.ai_data_analysis_enabled")}
          </Label>
          <p className="text-xs text-slate-500">
            {t("environments.settings.general.ai_data_analysis_enabled_description")}
          </p>
        </div>
      </div>

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
