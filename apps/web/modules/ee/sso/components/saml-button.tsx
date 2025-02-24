"use client";

import { Button } from "@/modules/ui/components/button";
import { useTranslate } from "@tolgee/react";
import { LockIcon } from "lucide-react";
import { signIn } from "next-auth/react";
import { FORMBRICKS_LOGGED_IN_WITH_LS } from "@formbricks/lib/localStorage";

interface SamlButtonProps {
  inviteUrl?: string | null;
  lastUsed?: boolean;
  samlTenant: string;
  samlProduct: string;
}

export const SamlButton = ({ inviteUrl, lastUsed, samlTenant, samlProduct }: SamlButtonProps) => {
  const { t } = useTranslate();

  const handleLogin = async () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(FORMBRICKS_LOGGED_IN_WITH_LS, "Saml");
    }
    signIn(
      "saml",
      {
        redirect: true,
        callbackUrl: inviteUrl ? inviteUrl : "/", // redirect after login to /
      },
      {
        tenant: samlTenant,
        product: samlProduct,
      }
    );
  };

  return (
    <Button
      type="button"
      onClick={handleLogin}
      variant="secondary"
      className="relative w-full justify-center">
      {t("auth.continue_with_saml")}
      <LockIcon />
      {lastUsed && <span className="absolute right-3 text-xs opacity-50">{t("auth.last_used")}</span>}
    </Button>
  );
};
