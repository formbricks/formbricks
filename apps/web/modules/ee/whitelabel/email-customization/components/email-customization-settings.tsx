import { SettingsCard } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { ModalButton, UpgradePrompt } from "@/modules/ui/components/upgrade-prompt";
import { getTranslations } from "next-intl/server";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";

interface EmailCustomizationSettingsProps {
  hasWhiteLabelPermission: boolean;
  environmentId: string;
  isReadOnly: boolean;
}

export const EmailCustomizationSettings = async ({
  hasWhiteLabelPermission,
  environmentId,
  isReadOnly,
}: EmailCustomizationSettingsProps) => {
  const t = await getTranslations();

  const buttons: [ModalButton, ModalButton] = [
    {
      text: t("common.start_free_trial"),
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
      className="pb-0"
      title={t("environments.project.look.email_customization")}
      description={t("environments.project.look.email_customization_description")}>
      {true || hasWhiteLabelPermission ? (
        <>
          <p>landure</p>
          {/* <EditLogo project={project} environmentId={params.environmentId} isReadOnly={isReadOnly} /> */}
        </>
      ) : (
        <UpgradePrompt
          title={t("environments.project.look.customize_email_with_a_higher_plan")}
          description={t("environments.project.look.eliminate_branding_with_whitelabel")}
          buttons={buttons}
        />
      )}
      {hasWhiteLabelPermission && isReadOnly && (
        <Alert variant="warning" className="mt-4">
          <AlertDescription>
            {t("common.only_owners_managers_and_manage_access_members_can_perform_this_action")}
          </AlertDescription>
        </Alert>
      )}
    </SettingsCard>
  );
};
