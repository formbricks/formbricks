import { useTranslations } from "next-intl";
import Link from "next/link";

interface TermsPrivacyLinksProps {
  termsUrl?: string;
  privacyUrl?: string;
}

export const TermsPrivacyLinks = ({ termsUrl, privacyUrl }: TermsPrivacyLinksProps) => {
  const t = useTranslations();

  if (!termsUrl && !privacyUrl) return null;

  return (
    <div className="mt-3 text-center text-xs text-slate-500">
      {t("auth.signup.terms_of_service")}
      <br />
      {termsUrl && (
        <Link className="font-semibold" href={termsUrl} rel="noreferrer" target="_blank">
          {t("auth.signup.terms_of_service")}
        </Link>
      )}
      {termsUrl && privacyUrl && <span> {t("common.and")} </span>}
      {privacyUrl && (
        <Link className="font-semibold" href={privacyUrl} rel="noreferrer" target="_blank">
          {t("auth.signup.privacy_policy")}
        </Link>
      )}
      <hr className="mx-6 mt-3"></hr>
    </div>
  );
};
