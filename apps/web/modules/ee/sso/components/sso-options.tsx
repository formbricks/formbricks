"use client";

import { useTranslate } from "@tolgee/react";
import { useEffect, useState } from "react";
import { FORMBRICKS_LOGGED_IN_WITH_LS } from "@formbricks/lib/localStorage";
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
  callbackUrl: string;
  samlSsoEnabled: boolean;
  samlTenant: string;
  samlProduct: string;
}

export const SSOOptions = ({
  googleOAuthEnabled,
  githubOAuthEnabled,
  azureOAuthEnabled,
  oidcOAuthEnabled,
  oidcDisplayName,
  callbackUrl,
  samlSsoEnabled,
  samlTenant,
  samlProduct,
}: SSOOptionsProps) => {
  const { t } = useTranslate();
  const [lastLoggedInWith, setLastLoggedInWith] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setLastLoggedInWith(localStorage.getItem(FORMBRICKS_LOGGED_IN_WITH_LS) || "");
    }
  }, []);

  return (
    <div className="space-y-2">
      {googleOAuthEnabled && (
        <GoogleButton inviteUrl={callbackUrl} lastUsed={lastLoggedInWith === "Google"} />
      )}
      {githubOAuthEnabled && (
        <GithubButton inviteUrl={callbackUrl} lastUsed={lastLoggedInWith === "Github"} />
      )}
      {azureOAuthEnabled && <AzureButton inviteUrl={callbackUrl} lastUsed={lastLoggedInWith === "Azure"} />}
      {oidcOAuthEnabled && (
        <OpenIdButton
          inviteUrl={callbackUrl}
          lastUsed={lastLoggedInWith === "OpenID"}
          text={t("auth.continue_with_oidc", { oidcDisplayName })}
        />
      )}
      {samlSsoEnabled && (
        <SamlButton
          inviteUrl={callbackUrl}
          lastUsed={lastLoggedInWith === "Saml"}
          samlTenant={samlTenant}
          samlProduct={samlProduct}
        />
      )}
    </div>
  );
};
