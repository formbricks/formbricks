"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { logger } from "@formbricks/logger";
import { authClient } from "@/modules/auth/lib/auth-client";
import { verifyEmailChangeAction } from "@/modules/auth/verify-email-change/actions";

interface EmailChangeSignInProps {
  token: string;
}

export const EmailChangeSignIn = ({ token }: EmailChangeSignInProps) => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<"success" | "error" | "loading">("loading");

  // The token this component has already sent for verification. Consuming a token changes the email,
  // which re-keys its fingerprint and makes the token single-use — so a second call for the same token
  // is always rejected. React StrictMode double-invokes effects in dev, and without this guard the
  // rejected second call overwrites the first call's success: the email really does change, but the page
  // reports failure. The action was idempotent before the binding landed, which is why this is new.
  const submittedTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof token !== "string" || token.trim() === "") {
      setStatus("error");
      return;
    }

    if (submittedTokenRef.current === token) {
      return;
    }
    submittedTokenRef.current = token;

    verifyEmailChangeAction({ token })
      .then((result) => {
        setStatus(result?.data ? "success" : "error");
      })
      .catch((error) => {
        logger.error(
          error instanceof Error ? error : new Error(String(error)),
          "Email-change verification failed"
        );
        setStatus("error");
      });
  }, [token]);

  useEffect(() => {
    if (status === "success") {
      // Email changed server-side; drop the now-stale session so the user re-authenticates with
      // their new address. Best-effort — the email change itself already succeeded. The BA client
      // resolves HTTP failures as { error } rather than throwing, so handle both shapes.
      authClient
        .signOut()
        .then(({ error }) => {
          if (error) {
            logger.error(
              new Error(error.message ?? "signOut returned an error"),
              "Email-change signOut failed"
            );
          }
        })
        .catch((error) => {
          logger.error(
            error instanceof Error ? error : new Error(String(error)),
            "Email-change signOut failed"
          );
        });
    }
  }, [status]);

  const text = {
    heading: {
      success: t("auth.email-change.email_change_success"),
      error: t("auth.email-change.email_verification_failed"),
      loading: t("auth.email-change.email_verification_loading"),
    },
    description: {
      success: t("auth.email-change.email_change_success_description"),
      error: t("auth.email-change.invalid_or_expired_token"),
      loading: t("auth.email-change.email_verification_loading_description"),
    },
  };

  return (
    <>
      <h1 className={`mb-4 text-center leading-2 font-bold ${status === "error" ? "text-red-600" : ""}`}>
        {text.heading[status]}
      </h1>
      <p className="text-center text-sm">{text.description[status]}</p>
      <hr className="my-4" />
    </>
  );
};
