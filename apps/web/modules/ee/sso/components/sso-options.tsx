"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FORMBRICKS_LOGGED_IN_WITH_LS } from "@/lib/localStorage";
import { AzureButton } from "./azure-button";
import { GithubButton } from "./github-button";
import { GoogleButton } from "./google-button";
import { OpenIdButton } from "./open-id-button";
import { SamlButton } from "./saml-button";

interface SSOOptionsProps {
  googleOAuthEnabled: boolean;
  githubOAuthEnabled: boolean;
  azureOAuthEnabled: boolean;
  oidcOAuthEnabled: boolean;
  oidcDisplayName?: string;
  returnToUrl: string;
  samlSsoEnabled: boolean;
  samlTenant: string;
  samlProduct: string;
  source: "signin" | "signup";
}

export const SSOOptions = ({
  googleOAuthEnabled,
  githubOAuthEnabled,
  azureOAuthEnabled,
  oidcOAuthEnabled,
  oidcDisplayName,
  returnToUrl,
  samlSsoEnabled,
  samlTenant,
  samlProduct,
  source,
}: SSOOptionsProps) => {
  const { t } = useTranslation();
  const [lastLoggedInWith, setLastLoggedInWith] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setLastLoggedInWith(localStorage.getItem(FORMBRICKS_LOGGED_IN_WITH_LS) || "");
    }
  }, []);

  return (
    <div className="space-y-2">
      {googleOAuthEnabled && (
        <GoogleButton returnToUrl={returnToUrl} lastUsed={lastLoggedInWith === "Google"} source={source} />
      )}
      {githubOAuthEnabled && (
        <GithubButton returnToUrl={returnToUrl} lastUsed={lastLoggedInWith === "Github"} source={source} />
      )}
      {azureOAuthEnabled && (
        <AzureButton returnToUrl={returnToUrl} lastUsed={lastLoggedInWith === "Azure"} source={source} />
      )}
      {oidcOAuthEnabled && (
        <OpenIdButton
          returnToUrl={returnToUrl}
          lastUsed={lastLoggedInWith === "OpenID"}
          text={t("auth.continue_with_oidc", { oidcDisplayName })}
          source={source}
        />
      )}
      {samlSsoEnabled && (
        <SamlButton
          returnToUrl={returnToUrl}
          lastUsed={lastLoggedInWith === "Saml"}
          samlTenant={samlTenant}
          samlProduct={samlProduct}
          source={source}
        />
      )}
    </div>
  );
};
