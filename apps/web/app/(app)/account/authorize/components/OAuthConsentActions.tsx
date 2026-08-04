"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { authClient } from "@/modules/auth/lib/auth-client";
import { Button } from "@/modules/ui/components/button";
import { resolveConsentRedirectUrl } from "../lib/consent-redirect";

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

      // Better Auth returns { redirect: true, url } (both accept and deny) — not { redirect_uri }.
      const redirectUrl = resolveConsentRedirectUrl(response.data);
      if (!redirectUrl) {
        toast.error(t("auth.oauth.consent_failed"));
        return;
      }

      window.location.href = redirectUrl;
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
