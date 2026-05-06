"use client";

import type { Session } from "next-auth";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TOrganization } from "@formbricks/types/organizations";
import { TUser } from "@formbricks/types/user";
import { DeleteAccountModal } from "@/modules/account/components/DeleteAccountModal";
import {
  ACCOUNT_DELETION_GOOGLE_REAUTH_NOT_CONFIGURED_ERROR_CODE,
  ACCOUNT_DELETION_SSO_REAUTH_ERROR_QUERY_PARAM,
} from "@/modules/account/constants";
import { Button } from "@/modules/ui/components/button";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";

interface DeleteAccountProps {
  session: Session | null;
  IS_FORMBRICKS_CLOUD: boolean;
  user: TUser;
  organizationsWithSingleOwner: TOrganization[];
  accountDeletionError?: string | string[];
  isMultiOrgEnabled: boolean;
  requiresPasswordConfirmation: boolean;
}

export const DeleteAccount = ({
  session,
  IS_FORMBRICKS_CLOUD,
  user,
  organizationsWithSingleOwner,
  accountDeletionError,
  isMultiOrgEnabled,
  requiresPasswordConfirmation,
}: Readonly<DeleteAccountProps>) => {
  const [isModalOpen, setModalOpen] = useState(false);
  const isDeleteDisabled = !isMultiOrgEnabled && organizationsWithSingleOwner.length > 0;
  const { t } = useTranslation();
  const accountDeletionErrorCode = Array.isArray(accountDeletionError)
    ? accountDeletionError[0]
    : accountDeletionError;
  const hasShownAccountDeletionError = useRef(false);

  useEffect(() => {
    if (!accountDeletionErrorCode || hasShownAccountDeletionError.current) {
      return;
    }

    hasShownAccountDeletionError.current = true;

    if (accountDeletionErrorCode === ACCOUNT_DELETION_GOOGLE_REAUTH_NOT_CONFIGURED_ERROR_CODE) {
      toast.error(t("environments.settings.profile.google_sso_account_deletion_requires_setup"), {
        id: "account-deletion-sso-reauth-error",
      });
    } else {
      toast.error(t("environments.settings.profile.sso_reauthentication_failed"), {
        id: "account-deletion-sso-reauth-error",
      });
    }

    const url = new URL(globalThis.location.href);
    url.searchParams.delete(ACCOUNT_DELETION_SSO_REAUTH_ERROR_QUERY_PARAM);
    globalThis.history.replaceState(null, "", url.toString());
  }, [accountDeletionErrorCode, t]);

  if (!session) {
    return null;
  }

  return (
    <div>
      <DeleteAccountModal
        requiresPasswordConfirmation={requiresPasswordConfirmation}
        open={isModalOpen}
        setOpen={setModalOpen}
        user={user}
        isFormbricksCloud={IS_FORMBRICKS_CLOUD}
        organizationsWithSingleOwner={organizationsWithSingleOwner}
      />
      <p className="text-sm text-slate-700">
        <strong>{t("environments.settings.profile.warning_cannot_undo")}</strong>
      </p>
      <TooltipRenderer
        shouldRender={isDeleteDisabled}
        tooltipContent={t("environments.settings.profile.warning_cannot_delete_account")}>
        <Button
          className="mt-4"
          variant="destructive"
          size="sm"
          onClick={() => setModalOpen(!isModalOpen)}
          disabled={isDeleteDisabled}>
          {t("environments.settings.profile.confirm_delete_my_account")}
        </Button>
      </TooltipRenderer>
    </div>
  );
};
