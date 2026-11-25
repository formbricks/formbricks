"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { TOrganization } from "@formbricks/types/organizations";
import { updateOrganizationSettings } from "@/app/(app)/workspaces/[workspaceId]/settings/organization/general/lib/api-client";
import { getAccessFlags } from "@/lib/membership/utils";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { AdvancedOptionToggle } from "@/modules/ui/components/advanced-option-toggle";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";

interface HideUnavailableFeaturesToggleProps {
  organization: TOrganization;
  membershipRole?: TOrganizationRole;
}

/**
 * Hides the workspace navigation items the organization's plan or licence does not include, for everyone
 * in the organization. Only the navigation changes: a direct link still opens the page and its upgrade
 * state. Owners and managers edit it, as they do the AI setting.
 */
export const HideUnavailableFeaturesToggle = ({
  organization,
  membershipRole,
}: Readonly<HideUnavailableFeaturesToggleProps>) => {
  const [isSaving, setIsSaving] = useState(false);
  const { t } = useTranslation();
  const router = useRouter();

  const { isOwner, isManager } = getAccessFlags(membershipRole);
  const canEdit = isOwner || isManager;

  const handleToggle = async (checked: boolean) => {
    setIsSaving(true);
    try {
      await updateOrganizationSettings(organization.id, { hideUnavailableFeatures: checked });
      toast.success(t("workspace.settings.general.navigation_settings_updated_successfully"));
      router.refresh();
    } catch (error) {
      toast.error(getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again")));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <AdvancedOptionToggle
        isChecked={organization.hideUnavailableFeatures}
        onToggle={handleToggle}
        htmlId="hide-unavailable-features-toggle"
        title={t("workspace.settings.general.hide_unavailable_features")}
        description={t("workspace.settings.general.hide_unavailable_features_description")}
        disabled={isSaving || !canEdit}
        customContainerClass="px-0"
      />

      {!canEdit && (
        <Alert variant="warning" alertRole="status">
          <AlertDescription>
            {t("common.only_owners_managers_and_manage_access_members_can_perform_this_action")}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
