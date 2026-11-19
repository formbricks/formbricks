"use client";

import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";
import { useRevokeMcpGrant } from "../hooks/use-revoke-mcp-grant";
import { getMcpGrantRevokeFailureMessage } from "../lib/revoke-grant";

interface RevokeMcpGrantButtonProps {
  clientId: string;
  clientName: string;
}

/** Revoke on Authorized apps: asks to confirm, then ends the client's access from its next call. */
export const RevokeMcpGrantButton = ({ clientId, clientName }: Readonly<RevokeMcpGrantButtonProps>) => {
  const { t } = useTranslation();
  const revoke = useRevokeMcpGrant();

  const handleRevoke = () => {
    if (!globalThis.confirm(t("auth.oauth.revoke_confirmation"))) return;
    revoke.mutate(clientId, {
      onSuccess: () => toast.success(t("auth.oauth.consent_revoked")),
      onError: (error) => toast.error(getMcpGrantRevokeFailureMessage(error, t)),
    });
  };

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      aria-label={t("auth.oauth.revoke_access_label", { clientName })}
      onClick={handleRevoke}
      loading={revoke.isPending}>
      {t("auth.oauth.revoke")}
    </Button>
  );
};
