"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { authClient } from "@/modules/auth/lib/auth-client";
import { Button } from "@/modules/ui/components/button";

export const OAuthConsentActions = () => {
  const { t } = useTranslation();
  const [pendingAction, setPendingAction] = useState<"accept" | "deny" | null>(null);

  const handleConsent = async (accept: boolean) => {
    const action = accept ? "accept" : "deny";
    setPendingAction(action);

    try {
      const response = await authClient.oauth2.consent({ accept });
      if (response.error) {
        toast.error(t("auth.oauth.consent_failed"));
        return;
      }

      const redirectUri =
        response.data &&
        typeof response.data === "object" &&
        "redirect_uri" in response.data &&
        typeof response.data.redirect_uri === "string" &&
        response.data.redirect_uri.length > 0
          ? response.data.redirect_uri
          : null;

      if (!redirectUri) {
        toast.error(t("auth.oauth.consent_failed"));
        return;
      }

      window.location.href = redirectUri;
    } catch {
      toast.error(t("auth.oauth.consent_failed"));
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button
        type="button"
        variant="secondary"
        onClick={() => handleConsent(false)}
        loading={pendingAction === "deny"}
        disabled={pendingAction !== null}>
        {t("auth.oauth.deny_access")}
      </Button>
      <Button
        type="button"
        onClick={() => handleConsent(true)}
        loading={pendingAction === "accept"}
        disabled={pendingAction !== null}>
        {t("auth.oauth.allow_access")}
      </Button>
    </div>
  );
};
