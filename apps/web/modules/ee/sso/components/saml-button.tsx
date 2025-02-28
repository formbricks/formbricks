"use client";

import { doesSamlConnectionExistAction } from "@/modules/ee/sso/actions";
import { Button } from "@/modules/ui/components/button";
import { useTranslate } from "@tolgee/react";
import { LockIcon } from "lucide-react";
import { signIn } from "next-auth/react";
import { useState } from "react";
import toast from "react-hot-toast";
import { FORMBRICKS_LOGGED_IN_WITH_LS } from "@formbricks/lib/localStorage";

interface SamlButtonProps {
  inviteUrl?: string;
  lastUsed?: boolean;
  samlTenant: string;
  samlProduct: string;
}

export const SamlButton = ({ inviteUrl, lastUsed, samlTenant, samlProduct }: SamlButtonProps) => {
  const { t } = useTranslate();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(FORMBRICKS_LOGGED_IN_WITH_LS, "Saml");
    }
    setIsLoading(true);
    const doesSamlConnectionExist = await doesSamlConnectionExistAction();
    if (!doesSamlConnectionExist?.data) {
      toast.error(t("auth.saml_connection_error"));
      setIsLoading(false);
      return;
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
      className="relative w-full justify-center"
      loading={isLoading}>
      {t("auth.continue_with_saml")}

      <LockIcon />
      {lastUsed && <span className="absolute right-3 text-xs opacity-50">{t("auth.last_used")}</span>}
    </Button>
  );
};
