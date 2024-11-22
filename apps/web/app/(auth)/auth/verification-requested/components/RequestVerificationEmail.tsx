"use client";

import { Button } from "@/modules/ui/components/button";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import toast from "react-hot-toast";
import { resendVerificationEmail } from "@formbricks/lib/utils/users";

interface RequestEmailVerificationProps {
  email: string | null;
}

export const RequestVerificationEmail = ({ email }: RequestEmailVerificationProps) => {
  const t = useTranslations();
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
    try {
      if (!email) throw new Error("No email provided");
      await resendVerificationEmail(email);
      toast.success(t("auth.verification-requested.verification_email_successfully_sent"));
    } catch (e) {
      toast.error(`Error: ${e.message}`);
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
