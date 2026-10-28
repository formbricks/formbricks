"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { AuthFooter } from "@/modules/auth/components/auth-card";
import { AuthLink } from "@/modules/auth/components/auth-link";
import { buildAttributionQuerySuffix } from "@/modules/auth/lib/attribution";

/**
 * "Already have an account? Log in", under the sign-up card. An invite token in the query string comes
 * along as the login callback, so someone who already has an account lands back on the invite.
 */
export const SignupFooter = ({ webAppUrl }: Readonly<{ webAppUrl: string }>) => {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const inviteToken = searchParams?.get("inviteToken");

  const loginHref = useMemo(() => {
    const base = inviteToken
      ? `/auth/login?callbackUrl=${webAppUrl}/invite?token=${inviteToken}`
      : "/auth/login";
    const attributionSuffix = buildAttributionQuerySuffix(searchParams);
    if (!attributionSuffix) return base;
    return `${base}${base.includes("?") ? "&" : "?"}${attributionSuffix}`;
  }, [inviteToken, searchParams, webAppUrl]);

  return (
    <AuthFooter>
      {t("shell.auth.signup.have_account")} <AuthLink href={loginHref}>{t("auth.signup.log_in")}</AuthLink>
    </AuthFooter>
  );
};
