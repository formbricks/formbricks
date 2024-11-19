import { AccountSettingsNavbar } from "@/app/(app)/environments/[environmentId]/settings/(account)/components/AccountSettingsNavbar";
import { AccountSecurity } from "@/app/(app)/environments/[environmentId]/settings/(account)/profile/components/AccountSecurity";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { authOptions } from "@formbricks/lib/authOptions";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getUser } from "@formbricks/lib/user/service";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/components/PageHeader";
import { SettingsId } from "@formbricks/ui/components/SettingsId";
import { SettingsCard } from "../../components/SettingsCard";
import { DeleteAccount } from "./components/DeleteAccount";
import { EditProfileAvatarForm } from "./components/EditProfileAvatarForm";
import { EditProfileDetailsForm } from "./components/EditProfileDetailsForm";

const Page = async (props: { params: Promise<{ environmentId: string }> }) => {
  const params = await props.params;
  const t = await getTranslations();
  const { environmentId } = params;
  const session = await getServerSession(authOptions);
  if (!session) {
    throw new Error(t("common.session_not_found"));
  }

  const organization = await getOrganizationByEnvironmentId(environmentId);

  if (!organization) {
    throw new Error(t("common.organization_not_found"));
  }

  const membership = await getMembershipByUserIdOrganizationId(session.user.id, organization.id);

  if (!membership) {
    throw new Error(t("common.membership_not_found"));
  }

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
              <AccountSecurity user={user} />
            </SettingsCard>
          )}

          <SettingsCard
            title={t("environments.settings.profile.delete_account")}
            description={t("environments.settings.profile.confirm_delete_account")}>
            <DeleteAccount session={session} IS_FORMBRICKS_CLOUD={IS_FORMBRICKS_CLOUD} user={user} />
          </SettingsCard>
          <SettingsId title={t("common.profile")} id={user.id}></SettingsId>
        </div>
      )}
    </PageContentWrapper>
  );
};

export default Page;
