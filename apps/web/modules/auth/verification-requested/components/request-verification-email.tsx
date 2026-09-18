"use client";

import { useEffect } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { SSO_RECOVERY_LINK_EXPIRED_ERROR_CODE } from "@formbricks/types/errors";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { Button } from "@/modules/ui/components/button";
import { resendVerificationEmailAction } from "../actions";

interface RequestVerificationEmailProps {
  email: string | null;
  callbackUrl?: string | null;
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
    const response = await resendVerificationEmailAction({
      email,
      callbackUrl: callbackUrl ?? undefined,
    });
    if (response?.data) {
      toast.success(t("auth.verification-requested.verification_email_resent_successfully"));
    } else {
      const errorMessage = getFormattedErrorMessage(response);
      // The recovery intent is gone — expired, consumed, or never real. The generic message would say
      // "something went wrong", which is both untrue and unactionable: nothing is broken, the link has
      // simply aged out, and signing in again is what fixes it. Same treatment the reset-password form
      // gives an expired token, using the same key.
      toast.error(
        errorMessage === SSO_RECOVERY_LINK_EXPIRED_ERROR_CODE ? t("c.link_expired_description") : errorMessage
      );
    }
  };

  return (
    <>
      <Button variant="secondary" onClick={requestVerificationEmail} className="w-full justify-center">
        {t("auth.verification-requested.resend_verification_email")}
      </Button>
    </>
  );
};
