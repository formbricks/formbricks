"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";

interface TermsPrivacyLinksProps {
  termsUrl?: string;
  privacyUrl?: string;
}

export const TermsPrivacyLinks = ({ termsUrl, privacyUrl }: Readonly<TermsPrivacyLinksProps>) => {
  const { t } = useTranslation();

  if (!termsUrl && !privacyUrl) return null;

  return (
    <div className="mt-3 text-center text-xs text-pretty text-slate-500">
      {termsUrl && (
        <Link
          className="inline-flex min-h-6 items-center rounded-sm py-1 font-semibold hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-brand-dark focus-visible:outline-hidden"
          href={termsUrl}
          rel="noreferrer"
          target="_blank">
          {t("auth.signup.terms_of_service")}
        </Link>
      )}
      {termsUrl && privacyUrl && <span> {t("common.and")} </span>}
      {privacyUrl && (
        <Link
          className="inline-flex min-h-6 items-center rounded-sm py-1 font-semibold hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-brand-dark focus-visible:outline-hidden"
          href={privacyUrl}
          rel="noreferrer"
          target="_blank">
          {t("auth.signup.privacy_policy")}
        </Link>
      )}
      <hr className="mt-3" />
    </div>
  );
};
