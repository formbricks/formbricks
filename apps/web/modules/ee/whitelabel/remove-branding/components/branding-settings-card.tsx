import { TWorkspace } from "@formbricks/types/workspace";
import { SettingsCard } from "@/app/(app)/workspaces/[workspaceId]/settings/components/SettingsCard";
import { ENTERPRISE_LICENSE_REQUEST_FORM_URL, IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getTranslate } from "@/lingodotdev/server";
import { EditBranding } from "@/modules/ee/whitelabel/remove-branding/components/edit-branding";
import { RemoveBrandingLicenseTip } from "@/modules/ee/whitelabel/remove-branding/components/remove-branding-license-tip";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { ModalButton, UpgradePrompt } from "@/modules/ui/components/upgrade-prompt";

interface BrandingSettingsCardProps {
  canRemoveBranding: boolean;
  workspace: TWorkspace;
  isReadOnly: boolean;
  showLiteLicenseTip?: boolean;
  userEmail?: string;
}

export const BrandingSettingsCard = async ({
  canRemoveBranding,
  workspace,
  isReadOnly,
  showLiteLicenseTip = false,
  userEmail,
}: Readonly<BrandingSettingsCardProps>) => {
  const t = await getTranslate();
  const workspaceBasePath = `/workspaces/${workspace.id}`;

  const buttons: [ModalButton, ModalButton] = [
    {
      text: IS_FORMBRICKS_CLOUD ? t("common.upgrade_plan") : t("common.request_trial_license"),
      href: IS_FORMBRICKS_CLOUD
        ? `${workspaceBasePath}/settings/organization/billing`
        : ENTERPRISE_LICENSE_REQUEST_FORM_URL,
    },
    {
      text: t("common.learn_more"),
      href: "https://formbricks.com/docs/self-hosting/advanced/enterprise-features/hide-powered-by-formbricks",
    },
  ];

  return (
    <SettingsCard
      title={t("workspace.look.formbricks_branding")}
      description={t("workspace.look.formbricks_branding_settings_description")}
      noPadding={showLiteLicenseTip}>
      {canRemoveBranding ? (
        <div className="space-y-4">
          <EditBranding
            type="linkSurvey"
            isEnabled={workspace.linkSurveyBranding}
            workspaceId={workspace.id}
            isReadOnly={isReadOnly}
          />
          <EditBranding
            type="appSurvey"
            isEnabled={workspace.inAppSurveyBranding}
            workspaceId={workspace.id}
            isReadOnly={isReadOnly}
          />
        </div>
      ) : showLiteLicenseTip && userEmail ? (
        <RemoveBrandingLicenseTip
          userEmail={userEmail}
          licenseRequestUrl={ENTERPRISE_LICENSE_REQUEST_FORM_URL}
        />
      ) : (
        <UpgradePrompt
          title={t("workspace.look.remove_branding_with_a_higher_plan")}
          description={t("workspace.settings.general.eliminate_branding_with_whitelabel")}
          buttons={buttons}
          feature="remove_branding"
        />
      )}
      {isReadOnly && (
        <Alert variant="warning" className="mt-4">
          <AlertDescription>
            {t("common.only_owners_managers_and_manage_access_members_can_perform_this_action")}
          </AlertDescription>
        </Alert>
      )}
    </SettingsCard>
  );
};
