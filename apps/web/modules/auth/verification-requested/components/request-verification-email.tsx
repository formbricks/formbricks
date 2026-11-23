"use client";

import { useEffect } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { SSO_RECOVERY_LINK_EXPIRED_ERROR_CODE } from "@formbricks/types/errors";
import { getV3ApiErrorMessage, getV3ApiErrorReason } from "@/modules/api/lib/v3-client";
import { resendVerificationEmail } from "@/modules/auth/lib/pre-login-api-client";
import { Button } from "@/modules/ui/components/button";

interface RequestVerificationEmailProps {
  readonly email: string | null;
  readonly callbackUrl?: string | null;
}

export const RequestVerificationEmail = ({ email, callbackUrl }: RequestVerificationEmailProps) => {
  const { t } = useTranslation();
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        location.reload();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const requestVerificationEmail = async () => {
    if (!email) return toast.error(t("auth.verification-requested.no_email_provided"));
    try {
      await resendVerificationEmail({ email, callbackUrl: callbackUrl ?? undefined });
    } catch (error) {
      // The recovery intent is gone — expired, consumed, or never real. The generic message would say
      // "something went wrong", which is both untrue and unactionable: nothing is broken, the link has
      // simply aged out, and signing in again is what fixes it. Same treatment the reset-password form
      // gives an expired token, using the same key.
      toast.error(
        getV3ApiErrorReason(error, "") === SSO_RECOVERY_LINK_EXPIRED_ERROR_CODE
          ? t("c.link_expired_description")
          : getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again"))
      );
      return;
    }
    toast.success(t("auth.verification-requested.verification_email_resent_successfully"));
  };

  return (
    <>
      <Button variant="secondary" onClick={requestVerificationEmail} className="w-full justify-center">
        {t("auth.verification-requested.resend_verification_email")}
      </Button>
    </>
  );
};
