import { getServerSession } from "next-auth";
import { AuthenticationError } from "@formbricks/types/errors";
import { AccountSecurity } from "@/app/(app)/workspaces/[workspaceId]/settings/account/profile/components/AccountSecurity";
import { DeleteAccount } from "@/app/(app)/workspaces/[workspaceId]/settings/account/profile/components/DeleteAccount";
import { EditProfileDetailsForm } from "@/app/(app)/workspaces/[workspaceId]/settings/account/profile/components/EditProfileDetailsForm";
import { SettingsCard } from "@/app/(app)/workspaces/[workspaceId]/settings/components/SettingsCard";
import {
  DISABLE_ACCOUNT_DELETION_SSO_CONFIRMATION,
  EMAIL_VERIFICATION_DISABLED,
  ENTERPRISE_LICENSE_REQUEST_FORM_URL,
  IS_FORMBRICKS_CLOUD,
  PASSWORD_RESET_DISABLED,
} from "@/lib/constants";
import { getOrganizationsWhereUserIsSingleOwner } from "@/lib/organization/service";
import { getUser } from "@/lib/user/service";
import { getTranslate } from "@/lingodotdev/server";
import { requiresPasswordConfirmationForAccountDeletion } from "@/modules/account/lib/account-deletion-auth";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { getIsMultiOrgEnabled, getIsTwoFactorAuthEnabled } from "@/modules/ee/license-check/lib/utils";
import { getSettingsLayoutData } from "@/modules/settings/lib/navigation-data";
import { getOrganizationBillingPath } from "@/modules/settings/lib/routes";
import { IdBadge } from "@/modules/ui/components/id-badge";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { UpgradePrompt } from "@/modules/ui/components/upgrade-prompt";

const Page = async (
  props: Readonly<{ searchParams: Promise<{ accountDeletionError?: string | string[] }> }>
) => {
  const isTwoFactorAuthEnabled = await getIsTwoFactorAuthEnabled();
  const isMultiOrgEnabled = await getIsMultiOrgEnabled();
  const searchParams = await props.searchParams;
  const t = await getTranslate();
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    throw new AuthenticationError(t("common.not_authenticated"));
  }

  const organizationsWithSingleOwner = await getOrganizationsWhereUserIsSingleOwner(session.user.id);
  const user = await getUser(session.user.id);
  if (!user) {
    throw new AuthenticationError(t("common.not_authenticated"));
  }

  // Two-factor upgrade points at the user's organization billing page (org-scoped after the refactor).
  const layoutData = await getSettingsLayoutData(session.user.id);
  const billingUpgradeHref = layoutData
    ? getOrganizationBillingPath(layoutData.organization.id, IS_FORMBRICKS_CLOUD)
    : "/";

  const isPasswordResetEnabled = !PASSWORD_RESET_DISABLED && user.identityProvider === "email";
  const requiresPasswordConfirmation = requiresPasswordConfirmationForAccountDeletion(user);

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.profile")} />
      <div>
        <SettingsCard
          title={t("workspace.settings.profile.personal_information")}
          description={t("workspace.settings.profile.update_personal_info")}>
          <EditProfileDetailsForm
            user={user}
            emailVerificationDisabled={EMAIL_VERIFICATION_DISABLED}
            isPasswordResetEnabled={isPasswordResetEnabled}
          />
        </SettingsCard>
        {user.identityProvider === "email" && (
          <SettingsCard
            title={t("common.security")}
            description={t("workspace.settings.profile.security_description")}>
            {!isTwoFactorAuthEnabled && !user.twoFactorEnabled ? (
              <UpgradePrompt
                title={t("workspace.settings.profile.unlock_two_factor_authentication")}
                description={t("workspace.settings.profile.two_factor_authentication_description")}
                buttons={[
                  {
                    text: IS_FORMBRICKS_CLOUD ? t("common.upgrade_plan") : t("common.request_trial_license"),
                    href: IS_FORMBRICKS_CLOUD ? billingUpgradeHref : ENTERPRISE_LICENSE_REQUEST_FORM_URL,
                  },
                  {
                    text: t("common.learn_more"),
                    href: IS_FORMBRICKS_CLOUD
                      ? billingUpgradeHref
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
          title={t("workspace.settings.profile.delete_account")}
          description={t("workspace.settings.profile.confirm_delete_account")}>
          <DeleteAccount
            session={session}
            IS_FORMBRICKS_CLOUD={IS_FORMBRICKS_CLOUD}
            user={user}
            organizationsWithSingleOwner={organizationsWithSingleOwner}
            isMultiOrgEnabled={isMultiOrgEnabled}
            accountDeletionError={searchParams.accountDeletionError}
            requiresPasswordConfirmation={requiresPasswordConfirmation}
            isSsoIdentityConfirmationDisabled={DISABLE_ACCOUNT_DELETION_SSO_CONFIRMATION}
          />
        </SettingsCard>
        <IdBadge id={user.id} label={t("common.profile_id")} variant="column" />
      </div>
    </PageContentWrapper>
  );
};

export default Page;
