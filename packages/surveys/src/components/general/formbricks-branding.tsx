import { useTranslation } from "react-i18next";

export function FormbricksBranding() {
  const { t } = useTranslation();
  return (
    <span className="flex justify-center">
      <a
        href="https://formbricks.com?utm_source=formbricks-app&utm_medium=survey&utm_campaign=powered_by_badge"
        target="_blank"
        rel="noopener">
        <p className="text-signature text-xs">
          {t("common.powered_by")}{" "}
          <b>
            <span className="text-branding-text hover:text-signature">Formbricks</span>
          </b>
        </p>
      </a>
    </span>
  );
}
