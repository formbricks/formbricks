"use client";

import {
  createConnectionAction,
  deleteConnectionAction,
  getConnectionsAction,
} from "@/modules/ee/sso/actions";
import { Button } from "@/modules/ui/components/button";
import { useTranslate } from "@tolgee/react";
import { LockIcon } from "lucide-react";
import { signIn } from "next-auth/react";
import { FORMBRICKS_LOGGED_IN_WITH_LS } from "@formbricks/lib/localStorage";

interface SamlButtonProps {
  inviteUrl?: string | null;
  lastUsed?: boolean;
}

export const SamlButton = ({ inviteUrl, lastUsed }: SamlButtonProps) => {
  const { t } = useTranslate();

  const handleLogin = async () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(FORMBRICKS_LOGGED_IN_WITH_LS, "Saml");
    }
    signIn(
      "boxyhq-saml",
      {
        redirect: true,
        callbackUrl: inviteUrl ? inviteUrl : "/", // redirect after login to /
      },
      {
        tenant: "formbricks.com",
        product: "formbricks.com",
      }
    );
  };

  const createConnection = () => {
    createConnectionAction();
  };

  const deleteConnection = () => {
    deleteConnectionAction();
  };

  const getConnections = () => {
    getConnectionsAction();
  };

  return (
    <>
      <Button type="button" onClick={createConnection}>
        create connection
      </Button>
      <Button type="button" onClick={deleteConnection}>
        delete connection
      </Button>
      <Button type="button" onClick={getConnections}>
        get connections
      </Button>
      <Button
        type="button"
        onClick={handleLogin}
        variant="secondary"
        className="relative w-full justify-center">
        {/* {t("auth.continue_with_google")} */}
        SAML
        <LockIcon />
        {lastUsed && <span className="absolute right-3 text-xs opacity-50">{t("auth.last_used")}</span>}
      </Button>
    </>
  );
};
