"use client";

import { LockIcon } from "lucide-react";
import { signIn } from "next-auth/react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { FORMBRICKS_LOGGED_IN_WITH_LS } from "@/lib/localStorage";
import { doesSamlConnectionExistAction } from "@/modules/ee/sso/actions";
import { getSsoReturnToUrl } from "@/modules/ee/sso/lib/utils";
import { Button } from "@/modules/ui/components/button";

interface SamlButtonProps {
  returnToUrl?: string;
  lastUsed?: boolean;
  variant?: "default" | "secondary";
  samlTenant: string;
  samlProduct: string;
  source: "signin" | "signup";
}

export const SamlButton = ({
  returnToUrl,
  lastUsed,
  variant = "secondary",
  samlTenant,
  samlProduct,
  source,
}: Readonly<SamlButtonProps>) => {
  const { t } = useTranslation();
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

    const returnToUrlWithSource = getSsoReturnToUrl(returnToUrl, source);

    signIn(
      "saml",
      {
        redirect: true,
        callbackUrl: returnToUrlWithSource,
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
      variant={variant}
      className="w-full justify-center"
      loading={isLoading}>
      {t("auth.continue_with_saml")}

      <LockIcon />
      {lastUsed && <span className="shrink-0 text-xs opacity-50">{t("auth.last_used")}</span>}
    </Button>
  );
};
