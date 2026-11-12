"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { authClient } from "@/modules/auth/lib/auth-client";
import type { TMcpGrantAccessSelection, TMcpGrantPermissions } from "@/modules/mcp/grant";
import { toMcpGrantAccessRequest } from "@/modules/mcp/grant-access";
import { Button } from "@/modules/ui/components/button";
import { resolveConsentRedirectUrl } from "../lib/consent-redirect";

interface OAuthConsentActionsProps {
  /** The scopes to grant when narrower than the request (a Dashboard viewer's); all of them otherwise. */
  readonly grantedScope?: string;
  /** The levels the user chose in the permission matrix, sent with Allow as the connection's grant. */
  readonly permissions: TMcpGrantPermissions;
  /** The organization & workspace access chosen with it; `null` while nothing is picked (Allow is off). */
  readonly access: TMcpGrantAccessSelection | null;
  readonly isAllowDisabled?: boolean;
}

export const OAuthConsentActions = ({
  grantedScope,
  permissions,
  access,
  isAllowDisabled = false,
}: OAuthConsentActionsProps) => {
  const { t } = useTranslation();
  const [pendingAction, setPendingAction] = useState<"accept" | "deny" | null>(null);

  const handleConsent = async (accept: boolean) => {
    const action = accept ? "accept" : "deny";
    setPendingAction(action);

    try {
      // `$fetch` rather than `oauth2.consent`: the grant (`mcp_grant`) is our field beside the provider's
      // body, read by the consent hooks (`mcp-grant-consent.ts`). The client plugin still adds the signed
      // `oauth_query` to the body.
      const response = await authClient.$fetch<unknown>("/oauth2/consent", {
        method: "POST",
        body: accept
          ? {
              accept,
              ...(grantedScope ? { scope: grantedScope } : {}),
              mcp_grant: { permissions, ...(access ? toMcpGrantAccessRequest(access) : {}) },
            }
          : { accept },
      });
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
        disabled={pendingAction !== null || isAllowDisabled}>
        {t("auth.oauth.allow_access")}
      </Button>
    </div>
  );
};
