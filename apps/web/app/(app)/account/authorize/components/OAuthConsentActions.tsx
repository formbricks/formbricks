"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { authClient } from "@/modules/auth/lib/auth-client";
import { getGrantErrorMessage } from "@/modules/auth/lib/mcp-grant-consent-errors";
import type { TRequestedMcpGrant } from "@/modules/mcp/grant";
import { Button } from "@/modules/ui/components/button";
import { getConsentApprovalBody } from "../lib/consent-approval";
import { resolveConsentRedirectUrl } from "../lib/consent-redirect";

interface OAuthConsentActionsProps {
  /** The request asks for identity alone, so Allow sends no grant (`isIdentityOnlyConsent`). */
  readonly identityOnly: boolean;
  /** The scopes to grant when narrower than the request (a Dashboard viewer's); all of them otherwise. */
  readonly grantedScope?: string;
  /** The grant the user chose in the matrix, sent with Allow as the connection's grant. */
  readonly grant: TRequestedMcpGrant;
  /** Whether Allow is off: the grant gives nothing, or the access picks nothing. */
  readonly isAllowDisabled?: boolean;
}

export const OAuthConsentActions = ({
  identityOnly,
  grantedScope,
  grant,
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
        body: accept ? getConsentApprovalBody({ identityOnly, grantedScope, grant }) : { accept },
      });
      if (response.error) {
        // A refused Allow says why: a pick the user can no longer select, a grant that couldn't be saved, or
        // one the client never asked for. Translated from the refusal's code, never its English detail.
        toast.error(getGrantErrorMessage(response.error, t) ?? t("auth.oauth.consent_failed"));
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
