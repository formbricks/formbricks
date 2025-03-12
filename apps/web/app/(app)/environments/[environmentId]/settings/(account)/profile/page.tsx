import { AccountSettingsNavbar } from "@/app/(app)/environments/[environmentId]/settings/(account)/components/AccountSettingsNavbar";
import { AccountSecurity } from "@/app/(app)/environments/[environmentId]/settings/(account)/profile/components/AccountSecurity";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { getIsMultiOrgEnabled, getIsTwoFactorAuthEnabled } from "@/modules/ee/license-check/lib/utils";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { SettingsId } from "@/modules/ui/components/settings-id";
import { UpgradePrompt } from "@/modules/ui/components/upgrade-prompt";
import { getTranslate } from "@/tolgee/server";
import { getServerSession } from "next-auth";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import {
  getOrganizationByEnvironmentId,
  getOrganizationsWhereUserIsSingleOwner,
} from "@formbricks/lib/organization/service";
import { getUser } from "@formbricks/lib/user/service";
import { SettingsCard } from "../../components/SettingsCard";
import { DeleteAccount } from "./components/DeleteAccount";
import { EditProfileAvatarForm } from "./components/EditProfileAvatarForm";
import { EditProfileDetailsForm } from "./components/EditProfileDetailsForm";

const Page = async (props: { params: Promise<{ environmentId: string }> }) => {
  const isTwoFactorAuthEnabled = await getIsTwoFactorAuthEnabled();
  const isMultiOrgEnabled = await getIsMultiOrgEnabled();
  const params = await props.params;
  const t = await getTranslate();
  const { environmentId } = params;
  const session = await getServerSession(authOptions);
  if (!session) {
    throw new Error(t("common.session_not_found"));
  }

  const organization = await getOrganizationByEnvironmentId(environmentId);

  if (!organization) {
    throw new Error(t("common.organization_not_found"));
  }

  const organizationsWithSingleOwner = await getOrganizationsWhereUserIsSingleOwner(session.user.id);

  const user = session && session.user ? await getUser(session.user.id) : null;

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.account_settings")}>
        <AccountSettingsNavbar environmentId={environmentId} activeId="profile" />
      </PageHeader>
      {user && (
        <div>
          <SettingsCard
            title={t("environments.settings.profile.personal_information")}
            description={t("environments.settings.profile.update_personal_info")}>
            <EditProfileDetailsForm user={user} />
          </SettingsCard>
          <SettingsCard
            title={t("common.avatar")}
            description={t("environments.settings.profile.organization_identification")}>
            {user && (
              <EditProfileAvatarForm
                session={session}
                environmentId={environmentId}
                imageUrl={user.imageUrl}
              />
            )}
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
                        ? t("common.start_free_trial")
                        : t("common.request_trial_license"),
                      href: IS_FORMBRICKS_CLOUD
                        ? `/environments/${params.environmentId}/settings/billing`
                        : "https://formbricks.com/upgrade-self-hosting-license",
                    },
                    {
                      text: t("common.learn_more"),
                      href: IS_FORMBRICKS_CLOUD
                        ? `/environments/${params.environmentId}/settings/billing`
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
          <SettingsId title={t("common.profile")} id={user.id}></SettingsId>
        </div>
      )}
    </PageContentWrapper>
  );
};

export default Page;
