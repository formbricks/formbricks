"use client";

import { useTransition } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { Button } from "@/modules/ui/components/button";
import { revokeOAuthConsentAction } from "../actions";

interface RevokeOAuthConsentButtonProps {
  consentId: string;
}

export const RevokeOAuthConsentButton = ({ consentId }: Readonly<RevokeOAuthConsentButtonProps>) => {
  const { t } = useTranslation();
  const [isPending, startTransition] = useTransition();

  const handleRevoke = () => {
    if (!window.confirm(t("auth.oauth.revoke_confirmation"))) {
      return;
    }

    startTransition(async () => {
      const result = await revokeOAuthConsentAction({ id: consentId });

      if (result?.data?.success) {
        toast.success(t("auth.oauth.consent_revoked"));
        return;
      }

      toast.error(getFormattedErrorMessage(result) || t("common.something_went_wrong_please_try_again"));
    });
  };

  return (
    <Button type="button" variant="secondary" size="sm" onClick={handleRevoke} loading={isPending}>
      {t("auth.oauth.revoke")}
    </Button>
  );
};
