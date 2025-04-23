import { SettingsCard } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { EditBranding } from "@/modules/ee/whitelabel/remove-branding/components/edit-branding";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { ModalButton, UpgradePrompt } from "@/modules/ui/components/upgrade-prompt";
import { getTranslate } from "@/tolgee/server";
import { Project } from "@prisma/client";

interface BrandingSettingsCardProps {
  canRemoveBranding: boolean;
  project: Project;
  environmentId: string;
  isReadOnly: boolean;
}

export const BrandingSettingsCard = async ({
  canRemoveBranding,
  project,
  environmentId,
  isReadOnly,
}: BrandingSettingsCardProps) => {
  const t = await getTranslate();

  const buttons: [ModalButton, ModalButton] = [
    {
      text: IS_FORMBRICKS_CLOUD ? t("common.start_free_trial") : t("common.request_trial_license"),
      href: IS_FORMBRICKS_CLOUD
        ? `/environments/${environmentId}/settings/billing`
        : "https://formbricks.com/upgrade-self-hosting-license",
    },
    {
      text: t("common.learn_more"),
      href: IS_FORMBRICKS_CLOUD
        ? `/environments/${environmentId}/settings/billing`
        : "https://formbricks.com/learn-more-self-hosting-license",
    },
  ];

  return (
    <SettingsCard
      title={t("environments.project.look.formbricks_branding")}
      description={t("environments.project.look.formbricks_branding_settings_description")}>
      {canRemoveBranding ? (
        <div className="space-y-4">
          <EditBranding
            type="linkSurvey"
            isEnabled={project.linkSurveyBranding}
            projectId={project.id}
            isReadOnly={isReadOnly}
          />
          <EditBranding
            type="appSurvey"
            isEnabled={project.inAppSurveyBranding}
            projectId={project.id}
            isReadOnly={isReadOnly}
          />
        </div>
      ) : (
        <UpgradePrompt
          title={t("environments.project.look.remove_branding_with_a_higher_plan")}
          description={t("environments.settings.general.eliminate_branding_with_whitelabel")}
          buttons={buttons}
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
