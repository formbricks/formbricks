"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { authLinkClassName } from "@/modules/auth/components/auth-link";

interface TermsPrivacyLinksProps {
  termsUrl?: string;
  privacyUrl?: string;
}

export const TermsPrivacyLinks = ({ termsUrl, privacyUrl }: Readonly<TermsPrivacyLinksProps>) => {
  const { t } = useTranslation();

  if (!termsUrl && !privacyUrl) return null;

  return (
    <p className="text-center text-[13px] leading-[18px] text-pretty text-slate-500">
      {termsUrl && (
        <Link className={authLinkClassName} href={termsUrl} rel="noreferrer" target="_blank">
          {t("auth.signup.terms_of_service")}
        </Link>
      )}
      {termsUrl && privacyUrl && <span> {t("common.and")} </span>}
      {privacyUrl && (
        <Link className={authLinkClassName} href={privacyUrl} rel="noreferrer" target="_blank">
          {t("auth.signup.privacy_policy")}
        </Link>
      )}
    </p>
  );
};
