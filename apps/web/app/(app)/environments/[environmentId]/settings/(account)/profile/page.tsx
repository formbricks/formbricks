import { AccountSettingsNavbar } from "@/app/(app)/environments/[environmentId]/settings/(account)/components/AccountSettingsNavbar";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { SettingsId } from "@/modules/ui/components/settings-id";
import { getTranslate } from "@/tolgee/server";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";
import { getOrganizationsWhereUserIsSingleOwner } from "@formbricks/lib/organization/service";
import { getUser } from "@formbricks/lib/user/service";
import { SettingsCard } from "../../components/SettingsCard";
import { DeleteAccount } from "./components/DeleteAccount";
import { EditCommunityAvatarForm } from "./components/EditCommunityAvatarForm";
import { EditCommunityForm } from "./components/EditCommunityDetailsForm";
import { EditProfileAvatarForm } from "./components/EditProfileAvatarForm";
import { EditProfileDetailsForm } from "./components/EditProfileDetailsForm";

// import { ManageSocialNetworks } from "./components/ManageSocialNetworks";

const Page = async (props: { params: Promise<{ environmentId: string }> }) => {
  const isMultiOrgEnabled = false;
  const params = await props.params;
  const t = await getTranslate();
  const { environmentId } = params;
  // const SUPABASE_KEY = process.env.SUPABASE_KEY || "";
  // const SUPABASE_URL = process.env.SUPABASE_URL || "";

  const { session } = await getEnvironmentAuth(params.environmentId);

  const organizationsWithSingleOwner = await getOrganizationsWhereUserIsSingleOwner(session.user.id);

  const user = session?.user ? await getUser(session.user.id) : null;

  if (!user) {
    throw new Error(t("common.user_not_found"));
  }

  const hasAccess = await hasUserEnvironmentAccess(session.user.id, params.environmentId);

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.account_settings")}>
        <AccountSettingsNavbar environmentId={environmentId} activeId="profile" hasAccess={hasAccess} />
      </PageHeader>
      {user && (
        <div>
          {/* {SUPABASE_KEY && SUPABASE_URL ? (
            <SettingsCard
              title={t("environments.settings.profile.social_accounts")}
              description={t("environments.settings.profile.manage_social_networks")}>
              <ManageSocialNetworks user={user} SUPABASE_URL={SUPABASE_URL} SUPABASE_KEY={SUPABASE_KEY} />
            </SettingsCard>
          ) : null} */}
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
          <SettingsCard
            title={t("common.community_profile")}
            description={t("environments.settings.profile.update_community_info")}>
            <EditCommunityForm user={user} />
          </SettingsCard>
          <SettingsCard
            title={t("common.community_avatar")}
            description={t("environments.settings.profile.update_your_community_avatar")}>
            {user && (
              <EditCommunityAvatarForm
                session={session}
                environmentId={environmentId}
                communityAvatarUrl={user.communityAvatarUrl}
              />
            )}
          </SettingsCard>
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
