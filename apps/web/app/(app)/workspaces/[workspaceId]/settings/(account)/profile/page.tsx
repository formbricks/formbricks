import { AuthenticationError } from "@formbricks/types/errors";
import { AccountSettingsNavbar } from "@/app/(app)/workspaces/[workspaceId]/settings/(account)/components/AccountSettingsNavbar";
import { AccountSecurity } from "@/app/(app)/workspaces/[workspaceId]/settings/(account)/profile/components/AccountSecurity";
import { DeleteAccount } from "@/app/(app)/workspaces/[workspaceId]/settings/(account)/profile/components/DeleteAccount";
import { EditProfileDetailsForm } from "@/app/(app)/workspaces/[workspaceId]/settings/(account)/profile/components/EditProfileDetailsForm";
import { SettingsCard } from "@/app/(app)/workspaces/[workspaceId]/settings/components/SettingsCard";
import { EMAIL_VERIFICATION_DISABLED, IS_FORMBRICKS_CLOUD, PASSWORD_RESET_DISABLED } from "@/lib/constants";
import { getOrganizationsWhereUserIsSingleOwner } from "@/lib/organization/service";
import { getUser } from "@/lib/user/service";
import { getTranslate } from "@/lingodotdev/server";
import { getIsMultiOrgEnabled, getIsTwoFactorAuthEnabled } from "@/modules/ee/license-check/lib/utils";
import { getWorkspaceAuth } from "@/modules/environments/lib/utils";
import { IdBadge } from "@/modules/ui/components/id-badge";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { UpgradePrompt } from "@/modules/ui/components/upgrade-prompt";

const Page = async (props: { params: Promise<{ workspaceId: string }> }) => {
  const isTwoFactorAuthEnabled = await getIsTwoFactorAuthEnabled();
  const isMultiOrgEnabled = await getIsMultiOrgEnabled();
  const params = await props.params;
  const t = await getTranslate();
  const { workspaceId } = params;

  const { session } = await getWorkspaceAuth(params.workspaceId);

  const organizationsWithSingleOwner = await getOrganizationsWhereUserIsSingleOwner(session.user.id);

  const user = session?.user ? await getUser(session.user.id) : null;

  if (!user) {
    throw new AuthenticationError(t("common.not_authenticated"));
  }

  const isPasswordResetEnabled = !PASSWORD_RESET_DISABLED && user.identityProvider === "email";

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.account_settings")}>
        <AccountSettingsNavbar environmentId={workspaceId} activeId="profile" />
      </PageHeader>
      {user && (
        <div>
          <SettingsCard
            title={t("environments.settings.profile.personal_information")}
            description={t("environments.settings.profile.update_personal_info")}>
            <EditProfileDetailsForm
              user={user}
              emailVerificationDisabled={EMAIL_VERIFICATION_DISABLED}
              isPasswordResetEnabled={isPasswordResetEnabled}
            />
          </SettingsCard>
          {user.identityProvider === "email" && (
            <SettingsCard
              title={t("common.security")}
              description={t("environments.settings.profile.security_description")}>
              {!isTwoFactorAuthEnabled && !user.twoFactorEnabled ? (
                <UpgradePrompt
                  title={t("environments.settings.profile.unlock_two_factor_authentication")}
                  description={t("environments.settings.profile.two_factor_authentication_description")}
                  buttons={[
                    {
                      text: IS_FORMBRICKS_CLOUD
                        ? t("common.upgrade_plan")
                        : t("common.request_trial_license"),
                      href: IS_FORMBRICKS_CLOUD
                        ? `/workspaces/${params.workspaceId}/settings/billing`
                        : "https://formbricks.com/upgrade-self-hosting-license",
                    },
                    {
                      text: t("common.learn_more"),
                      href: IS_FORMBRICKS_CLOUD
                        ? `/workspaces/${params.workspaceId}/settings/billing`
                        : "https://formbricks.com/learn-more-self-hosting-license",
                    },
                  ]}
                />
              ) : (
                <AccountSecurity user={user} />
              )}
            </SettingsCard>
          )}

          <SettingsCard
            title={t("environments.settings.profile.delete_account")}
            description={t("environments.settings.profile.confirm_delete_account")}>
            <DeleteAccount
              session={session}
              IS_FORMBRICKS_CLOUD={IS_FORMBRICKS_CLOUD}
              user={user}
              organizationsWithSingleOwner={organizationsWithSingleOwner}
              isMultiOrgEnabled={isMultiOrgEnabled}
            />
          </SettingsCard>
          <IdBadge id={user.id} label={t("common.profile_id")} variant="column" />
        </div>
      )}
    </PageContentWrapper>
  );
};

export default Page;
