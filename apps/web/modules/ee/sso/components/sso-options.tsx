"use client";

import { useTranslate } from "@tolgee/react";
import { AzureButton } from "./azure-button";
import { GithubButton } from "./github-button";
import { GoogleButton } from "./google-button";
import { OpenIdButton } from "./open-id-button";

interface SSOOptionsProps {
  googleOAuthEnabled: boolean;
  githubOAuthEnabled: boolean;
  azureOAuthEnabled: boolean;
  oidcOAuthEnabled: boolean;
  oidcDisplayName?: string;
  callbackUrl: string;
}

export const SSOOptions = ({
  googleOAuthEnabled,
  githubOAuthEnabled,
  azureOAuthEnabled,
  oidcOAuthEnabled,
  oidcDisplayName,
  callbackUrl,
}: SSOOptionsProps) => {
  const { t } = useTranslate();

  return (
    <div className="space-y-2">
      {googleOAuthEnabled && <GoogleButton inviteUrl={callbackUrl} />}
      {githubOAuthEnabled && <GithubButton inviteUrl={callbackUrl} />}
      {azureOAuthEnabled && <AzureButton inviteUrl={callbackUrl} />}
      {oidcOAuthEnabled && (
        <OpenIdButton inviteUrl={callbackUrl} text={t("auth.continue_with_oidc", { oidcDisplayName })} />
      )}
    </div>
  );
};
