import { useTranslation } from "react-i18next";

export function RecaptchaBranding() {
  const { t } = useTranslation();
  return (
    <p className="fb-text-signature fb-text-xs fb-text-center fb-leading-6 fb-text-balance">
      {t("common.protected_by_reCAPTCHA_and_the_Google")}{" "}
      <b>
        <a target="_blank" rel="noopener" href="https://policies.google.com/privacy">
          {t("common.privacy_policy")}
        </a>
      </b>{" "}
      {t("common.and")}{" "}
      <b>
        <a target="_blank" rel="noopener" href="https://policies.google.com/terms">
          {t("common.terms_of_service")}
        </a>
      </b>{" "}
      {t("common.apply")}.
    </p>
  );
}
