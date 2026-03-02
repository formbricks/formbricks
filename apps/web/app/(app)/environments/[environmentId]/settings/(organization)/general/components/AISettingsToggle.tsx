"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { TOrganization } from "@formbricks/types/organizations";
import { updateOrganizationAction } from "@/app/(app)/environments/[environmentId]/settings/(organization)/general/actions";
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

  const handleSwitchChange = async (checked: boolean) => {
    setIsLoading(true);
    try {
      const response = await updateOrganizationAction({
        organizationId: organization.id,
        data: { isAIEnabled: checked },
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
      <div className="flex items-center justify-between">
        <Label htmlFor="ai-settings-toggle">{t("environments.settings.general.ai_enabled")}</Label>
        <Switch
          id="ai-settings-toggle"
          aria-label={t("environments.settings.general.ai_enabled")}
          checked={organization.isAIEnabled}
          disabled={isLoading || !canEdit}
          onCheckedChange={handleSwitchChange}
        />
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
