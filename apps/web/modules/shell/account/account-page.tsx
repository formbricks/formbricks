import { AuthenticationError } from "@formbricks/types/errors";
import {
  EMAIL_VERIFICATION_DISABLED,
  ENTERPRISE_LICENSE_REQUEST_FORM_URL,
  IS_FORMBRICKS_CLOUD,
  PASSWORD_RESET_DISABLED,
} from "@/lib/constants";
import { getOrganizationsWhereUserIsSingleOwner } from "@/lib/organization/service";
import { getUser } from "@/lib/user/service";
import { getTranslate } from "@/lingodotdev/server";
import { requiresPasswordConfirmationForAccountDeletion } from "@/modules/account/lib/account-deletion-auth";
import { getSession } from "@/modules/auth/lib/session";
import { getIsMultiOrgEnabled, getIsTwoFactorAuthEnabled } from "@/modules/ee/license-check/lib/utils";
import { ShellPage, ShellPageHeader } from "@/modules/shell/components/shell-page";
import { getActiveOrganizationId } from "@/modules/shell/lib/active-organization";
import { IdBadge } from "@/modules/ui/components/id-badge";
import { DeleteAccountCard } from "./components/delete-account-card";
import { PasswordCard } from "./components/password-card";
import { ProfileCard } from "./components/profile-card";
import { TwoFactorCard } from "./components/two-factor-card";

/** The signed-in person's own account: profile, password, two-factor authentication, deletion. */
export const AccountPage = async () => {
  const t = await getTranslate();
  const session = await getSession();
  if (!session?.user) {
    throw new AuthenticationError(t("common.not_authenticated"));
  }

  const [user, organizationsWithSingleOwner, isMultiOrgEnabled, isTwoFactorAuthEnabled, organizationId] =
    await Promise.all([
      getUser(session.user.id),
      getOrganizationsWhereUserIsSingleOwner(session.user.id),
      getIsMultiOrgEnabled(),
      getIsTwoFactorAuthEnabled(),
      getActiveOrganizationId(),
    ]);
  if (!user) {
    throw new AuthenticationError(t("common.not_authenticated"));
  }

  const isCredentialUser = user.identityProvider === "email";
  // Password and two-factor belong to the credential login; an SSO user's provider owns both.
  const showPassword = isCredentialUser && !PASSWORD_RESET_DISABLED;
  const twoFactorAvailable = isTwoFactorAuthEnabled || user.twoFactorEnabled;
  const upgrade = IS_FORMBRICKS_CLOUD
    ? {
        href: `/organizations/${organizationId}/billing`,
        label: t("common.upgrade_plan"),
        external: false,
      }
    : { href: ENTERPRISE_LICENSE_REQUEST_FORM_URL, label: t("common.request_trial_license"), external: true };

  return (
    <ShellPage>
      <ShellPageHeader title={t("common.account")} />
      <ProfileCard user={user} emailVerificationDisabled={EMAIL_VERIFICATION_DISABLED} />
      {showPassword && <PasswordCard user={{ id: user.id, email: user.email }} />}
      {isCredentialUser && (
        <TwoFactorCard
          twoFactorEnabled={user.twoFactorEnabled}
          available={twoFactorAvailable}
          upgrade={upgrade}
        />
      )}
      <DeleteAccountCard
        user={user}
        isFormbricksCloud={IS_FORMBRICKS_CLOUD}
        organizationsWithSingleOwner={organizationsWithSingleOwner}
        isMultiOrgEnabled={isMultiOrgEnabled}
        requiresPasswordConfirmation={requiresPasswordConfirmationForAccountDeletion(user)}
      />
      <IdBadge id={user.id} label={t("common.profile_id")} variant="column" />
    </ShellPage>
  );
};
