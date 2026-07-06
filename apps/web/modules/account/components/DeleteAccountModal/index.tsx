"use client";

import { Dispatch, SetStateAction, useState } from "react";
import toast from "react-hot-toast";
import { Trans, useTranslation } from "react-i18next";
import { logger } from "@formbricks/logger";
import { TOrganization } from "@formbricks/types/organizations";
import { TUser } from "@formbricks/types/user";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import {
  ACCOUNT_DELETION_SOLE_OWNER_BLOCK_MESSAGE,
  FORMBRICKS_CLOUD_ACCOUNT_DELETION_SURVEY_URL,
} from "@/modules/account/constants";
import { useSignOut } from "@/modules/auth/hooks/use-sign-out";
import { authClient } from "@/modules/auth/lib/auth-client";
import { Alert, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import { Input } from "@/modules/ui/components/input";
import { PasswordInput } from "@/modules/ui/components/password-input";
import { requestSsoAccountDeletionEmailAction } from "./actions";

interface DeleteAccountModalProps {
  requiresPasswordConfirmation: boolean;
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  user: TUser;
  isFormbricksCloud: boolean;
  organizationsWithSingleOwner: TOrganization[];
}

export const DeleteAccountModal = ({
  requiresPasswordConfirmation,
  setOpen,
  open,
  user,
  isFormbricksCloud,
  organizationsWithSingleOwner,
}: Readonly<DeleteAccountModalProps>) => {
  const { t } = useTranslation();
  const [deleting, setDeleting] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [password, setPassword] = useState("");
  const [ssoEmailSent, setSsoEmailSent] = useState(false);
  const { signOut: signOutWithAudit } = useSignOut({ id: user.id, email: user.email });
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setInputValue("");
      setPassword("");
      setSsoEmailSent(false);
    }
    setOpen(nextOpen);
  };

  const hasValidEmailConfirmation = inputValue.trim().toLowerCase() === user.email.toLowerCase();
  const hasValidConfirmation =
    hasValidEmailConfirmation && (!requiresPasswordConfirmation || password.length > 0);
  const isDeleteDisabled = !hasValidConfirmation || ssoEmailSent;

  // Credential users: Better Auth verifies the password, runs the sole-owner guard (beforeDelete), then
  // deletes + cleans up (afterDelete). On success we sign out and redirect exactly as before.
  const deleteCredentialAccount = async () => {
    const { error } = await authClient.deleteUser({ password });

    if (error) {
      if (error.code === "INVALID_PASSWORD") {
        toast.error(t("workspace.settings.profile.wrong_password"));
        return;
      }

      if (error.message === ACCOUNT_DELETION_SOLE_OWNER_BLOCK_MESSAGE) {
        toast.error(t("workspace.settings.profile.warning_cannot_delete_account"));
        return;
      }

      logger.error({ error }, "Account deletion failed");
      toast.error(error.message ?? t("common.something_went_wrong_please_try_again"));
      return;
    }

    try {
      await signOutWithAudit({
        clearWorkspaceId: true,
        reason: "account_deletion",
        redirect: false,
      });
    } catch (signOutError) {
      logger.error({ error: signOutError }, "Failed to sign out after account deletion");
    }

    if (isFormbricksCloud) {
      globalThis.location.replace(FORMBRICKS_CLOUD_ACCOUNT_DELETION_SURVEY_URL);
    } else {
      globalThis.location.replace("/auth/login");
    }
  };

  // SSO users have no password, so deletion is confirmed via an email link. The account is removed only
  // when they click the emailed /api/auth/delete-user/callback link, so we keep the dialog open and show
  // an inline confirmation instead of signing out or redirecting.
  const requestSsoAccountDeletion = async () => {
    const result = await requestSsoAccountDeletionEmailAction();

    if (!result?.data?.emailSent) {
      const fallbackErrorMessage = t("common.something_went_wrong_please_try_again");
      const errorMessage = result ? getFormattedErrorMessage(result) : fallbackErrorMessage;
      logger.error({ errorMessage }, "Account deletion email request failed");
      toast.error(errorMessage || fallbackErrorMessage);
      return;
    }

    setSsoEmailSent(true);
  };

  const deleteAccount = async () => {
    try {
      if (!hasValidConfirmation || ssoEmailSent) {
        return;
      }

      setDeleting(true);

      if (requiresPasswordConfirmation) {
        await deleteCredentialAccount();
      } else {
        await requestSsoAccountDeletion();
      }
    } catch (error) {
      logger.error({ error }, "Account deletion failed");
      toast.error(t("common.something_went_wrong_please_try_again"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <DeleteDialog
      open={open}
      setOpen={handleOpenChange}
      deleteWhat={t("common.account")}
      onDelete={() => deleteAccount()}
      text={t("workspace.settings.profile.account_deletion_consequences_warning")}
      isDeleting={deleting}
      disabled={isDeleteDisabled}>
      <div className="py-5">
        {ssoEmailSent ? (
          <Alert variant="info">
            <AlertTitle>{t("common.account")}</AlertTitle>
            <AlertDescription>
              {t("workspace.settings.profile.account_deletion_email_sent", { email: user.email })}
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <ul className="list-disc pb-6 pl-6">
              <li>
                {t(
                  "workspace.settings.profile.permanent_removal_of_all_of_your_personal_information_and_data"
                )}
              </li>
              {organizationsWithSingleOwner.length > 0 && (
                <li>
                  <Trans
                    i18nKey="workspace.settings.profile.organizations_delete_message"
                    components={{ b: <b /> }}
                  />
                </li>
              )}
              {organizationsWithSingleOwner.length > 0 && (
                <ul className="ml-4" style={{ listStyleType: "circle" }}>
                  {organizationsWithSingleOwner.map((organization) => {
                    if (organization.name) {
                      return <li key={organization.name}>{organization.name}</li>;
                    }
                  })}
                </ul>
              )}
              <li>{t("workspace.settings.profile.warning_cannot_undo")}</li>
            </ul>
            <form
              data-testid="deleteAccountForm"
              onSubmit={async (e) => {
                e.preventDefault();
                await deleteAccount();
              }}>
              <label htmlFor="deleteAccountConfirmation">
                {t("workspace.settings.profile.please_enter_email_to_confirm_account_deletion", {
                  email: user.email,
                })}
              </label>
              <Input
                data-testid="deleteAccountConfirmation"
                value={inputValue}
                onChange={handleInputChange}
                placeholder={user.email}
                className="mt-2"
                type="text"
                id="deleteAccountConfirmation"
                name="deleteAccountConfirmation"
              />
              {requiresPasswordConfirmation && (
                <>
                  <label htmlFor="deleteAccountPassword" className="mt-4 block">
                    {t("common.password")}
                  </label>
                  <PasswordInput
                    data-testid="deleteAccountPassword"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className="pr-10"
                    containerClassName="mt-2"
                    id="deleteAccountPassword"
                    name="deleteAccountPassword"
                    required
                  />
                </>
              )}
            </form>
          </>
        )}
      </div>
    </DeleteDialog>
  );
};
