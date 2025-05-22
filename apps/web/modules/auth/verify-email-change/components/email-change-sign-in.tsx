"use client";

import { verifyEmailChangeAction } from "@/modules/auth/verify-email-change/actions";
import { useTranslate } from "@tolgee/react";
import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";

export const EmailChangeSignIn = ({ token }: { token: string }) => {
  const { t } = useTranslate();
  const [status, setStatus] = useState<"success" | "error" | "loading">("loading");

  useEffect(() => {
    const validateToken = async () => {
      if (typeof token === "string" && token.trim() !== "") {
        const result = await verifyEmailChangeAction({ token });

        if (!result?.data) {
          setStatus("error");
        } else {
          setStatus("success");
        }
      } else {
        setStatus("error");
      }
    };

    if (token) {
      validateToken();
    } else {
      setStatus("error");
    }
  }, [token]);

  useEffect(() => {
    if (status === "success") {
      signOut({ redirect: false });
    }
  }, [status]);

  return (
    <>
      <h1 className={`leading-2 mb-4 text-center font-bold ${status === "error" ? "text-red-600" : ""}`}>
        {status === "success"
          ? t("auth.email-change.email_change_success")
          : t("auth.email-change.email_verification_failed")}
      </h1>
      <p className="text-center text-sm">
        {status === "success"
          ? t("auth.email-change.email_change_success_description")
          : t("auth.email-change.invalid_or_expired_token")}
      </p>
      <hr className="my-4" />
    </>
  );
};
