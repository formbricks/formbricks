import { useTranslation } from "react-i18next";

export function RecaptchaBranding() {
  const { t } = useTranslation();
  return (
    <p className="text-signature text-center text-xs leading-6 text-balance">
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
