"use client";

import { signIn } from "next-auth/react";
import { Dispatch, SetStateAction, useState } from "react";
import toast from "react-hot-toast";
import { Trans, useTranslation } from "react-i18next";
import { logger } from "@formbricks/logger";
import { TOrganization } from "@formbricks/types/organizations";
import { TUser } from "@formbricks/types/user";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import {
  ACCOUNT_DELETION_CONFIRMATION_REQUIRED_ERROR_CODE,
  ACCOUNT_DELETION_EMAIL_MISMATCH_ERROR_CODE,
  ACCOUNT_DELETION_GOOGLE_REAUTH_NOT_CONFIGURED_ERROR_CODE,
  ACCOUNT_DELETION_SSO_REAUTH_REQUIRED_ERROR_CODE,
  DELETE_ACCOUNT_WRONG_PASSWORD_ERROR,
  FORMBRICKS_CLOUD_ACCOUNT_DELETION_SURVEY_URL,
} from "@/modules/account/constants";
import { useSignOut } from "@/modules/auth/hooks/use-sign-out";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import { Input } from "@/modules/ui/components/input";
import { PasswordInput } from "@/modules/ui/components/password-input";
import { deleteUserAction, startAccountDeletionSsoReauthenticationAction } from "./actions";

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
  const { signOut: signOutWithAudit } = useSignOut({ id: user.id, email: user.email });
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setInputValue("");
      setPassword("");
    }
    setOpen(nextOpen);
  };

  const hasValidEmailConfirmation = inputValue.trim().toLowerCase() === user.email.toLowerCase();
  const hasValidConfirmation =
    hasValidEmailConfirmation && (!requiresPasswordConfirmation || password.length > 0);
  const isDeleteDisabled = !hasValidConfirmation;
  const getLocalizedDeletionErrorMessage = (serverError?: string) => {
    if (serverError === DELETE_ACCOUNT_WRONG_PASSWORD_ERROR) {
      return t("environments.settings.profile.wrong_password");
    }

    if (serverError === ACCOUNT_DELETION_GOOGLE_REAUTH_NOT_CONFIGURED_ERROR_CODE) {
      return t("environments.settings.profile.google_sso_account_deletion_requires_setup");
    }

    if (serverError === ACCOUNT_DELETION_EMAIL_MISMATCH_ERROR_CODE) {
      return t("environments.settings.profile.email_confirmation_does_not_match");
    }

    if (serverError === ACCOUNT_DELETION_CONFIRMATION_REQUIRED_ERROR_CODE) {
      return t("environments.settings.profile.delete_account_confirmation_required");
    }

    if (serverError === ACCOUNT_DELETION_SSO_REAUTH_REQUIRED_ERROR_CODE) {
      return t("environments.settings.profile.sso_reauthentication_failed");
    }

    return null;
  };

  const startSsoReauthentication = async () => {
    const result = await startAccountDeletionSsoReauthenticationAction({
      confirmationEmail: inputValue,
      returnToUrl: globalThis.location.href,
    });

    if (!result?.data) {
      const fallbackErrorMessage = t("common.something_went_wrong_please_try_again");
      const errorMessage =
        getLocalizedDeletionErrorMessage(result?.serverError) ??
        (result ? getFormattedErrorMessage(result) : fallbackErrorMessage);

      logger.error({ errorMessage }, "Account deletion SSO reauthentication action failed");
      toast.error(errorMessage || fallbackErrorMessage);
      return;
    }

    await signIn(
      result.data.provider,
      {
        callbackUrl: result.data.callbackUrl,
        redirect: true,
      },
      result.data.authorizationParams
    );
  };

  const deleteAccount = async () => {
    try {
      if (!hasValidConfirmation) {
        return;
      }

      setDeleting(true);
      const result = await deleteUserAction(
        requiresPasswordConfirmation
          ? {
              confirmationEmail: inputValue,
              password,
            }
          : {
              confirmationEmail: inputValue,
            }
      );

      if (!result?.data?.success) {
        const fallbackErrorMessage = t("common.something_went_wrong_please_try_again");
        let errorMessage = getLocalizedDeletionErrorMessage(result?.serverError) ?? fallbackErrorMessage;

        if (result?.serverError === ACCOUNT_DELETION_SSO_REAUTH_REQUIRED_ERROR_CODE) {
          await startSsoReauthentication();
          return;
        } else if (result) {
          errorMessage =
            getLocalizedDeletionErrorMessage(result.serverError) ?? getFormattedErrorMessage(result);
        }

        logger.error({ errorMessage }, "Account deletion action failed");
        toast.error(errorMessage || fallbackErrorMessage);
        return;
      }

      // Sign out with account deletion reason (no automatic redirect)
      await signOutWithAudit({
        reason: "account_deletion",
        redirect: false, // Prevent NextAuth automatic redirect
        clearEnvironmentId: true,
      });

      // Manual redirect after signOut completes
      if (isFormbricksCloud) {
        globalThis.location.replace(FORMBRICKS_CLOUD_ACCOUNT_DELETION_SURVEY_URL);
      } else {
        globalThis.location.replace("/auth/login");
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
      text={t("environments.settings.profile.account_deletion_consequences_warning")}
      isDeleting={deleting}
      disabled={isDeleteDisabled}>
      <div className="py-5">
        <ul className="list-disc pb-6 pl-6">
          <li>
            {t(
              "environments.settings.profile.permanent_removal_of_all_of_your_personal_information_and_data"
            )}
          </li>
          {organizationsWithSingleOwner.length > 0 && (
            <li>
              <Trans
                i18nKey="environments.settings.profile.organizations_delete_message"
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
          <li>{t("environments.settings.profile.warning_cannot_undo")}</li>
        </ul>
        <form
          data-testid="deleteAccountForm"
          onSubmit={async (e) => {
            e.preventDefault();
            await deleteAccount();
          }}>
          <label htmlFor="deleteAccountConfirmation">
            {t("environments.settings.profile.please_enter_email_to_confirm_account_deletion", {
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
          {!requiresPasswordConfirmation && (
            <p className="mt-2 text-sm text-slate-600">
              {t("environments.settings.profile.sso_reauthentication_may_be_required_for_deletion")}
            </p>
          )}
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
      </div>
    </DeleteDialog>
  );
};
