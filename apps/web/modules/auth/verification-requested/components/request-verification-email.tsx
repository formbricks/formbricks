"use client";

import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { Button } from "@/modules/ui/components/button";
import { useTranslate } from "@tolgee/react";
import { useEffect } from "react";
import toast from "react-hot-toast";
import { resendVerificationEmailAction } from "../actions";

interface RequestVerificationEmailProps {
  email: string | null;
}

export const RequestVerificationEmail = ({ email }: RequestVerificationEmailProps) => {
  const { t } = useTranslate();
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
    const response = await resendVerificationEmailAction({ email });
    if (response?.data) {
      toast.success(t("auth.verification-requested.verification_email_successfully_sent", { email }));
    } else {
      const errorMessage = getFormattedErrorMessage(response);
      toast.error(errorMessage);
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
