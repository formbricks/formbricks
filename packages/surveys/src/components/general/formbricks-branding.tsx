import { useTranslation } from "react-i18next";

export function FormbricksBranding() {
  const { t } = useTranslation();
  return (
    <a
      href="https://formbricks.com?utm_source=survey_branding"
      target="_blank"
      tabIndex={-1}
      className="fb-flex fb-justify-center"
      rel="noopener">
      <p className="fb-text-signature fb-text-xs">
        {t("common.powered_by")}{" "}
        <b>
          <span className="fb-text-branding-text hover:fb-text-signature">Formbricks</span>
        </b>
      </p>
    </a>
  );
}
