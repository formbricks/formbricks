"use client";

import { verifyEmailChangeAction } from "@/modules/auth/verify-email-change/action";
import { useTranslate } from "@tolgee/react";
import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";

export const EmailChangeSignIn = ({ token }: { token: string }) => {
  const { t } = useTranslate();
  const [status, setStatus] = useState<"success" | "error" | "loading">("loading");

  useEffect(() => {
    const validateToken = async () => {
      if (typeof token === "string" && token.trim() !== "") {
        try {
          const result = await verifyEmailChangeAction({ token });

          if (result?.serverError) {
            setStatus("error");
          } else {
            setStatus("success");
          }
        } catch (err) {
          setStatus("error");
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
      <h1 className={`mb-4 text-center leading-2 font-bold ${status === "error" ? "text-red-600" : ""}`}>
        {status === "success"
          ? t("auth.email_change_success", "Email has been successfully changed.")
          : t("auth.email_verification_failed", "Email verification failed")}
      </h1>
      <p className="text-center text-sm">
        {status === "success"
          ? t("auth.email_change_success_description", "You can now log in using your new email address.")
          : t("auth.invalid_or_expired_token", "The token is invalid or has expired.")}
      </p>
      <hr className="my-4" />
    </>
  );
};
