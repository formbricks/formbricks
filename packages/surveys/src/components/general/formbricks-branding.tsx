import { useTranslation } from "react-i18next";

export function FormbricksBranding() {
  const { t } = useTranslation();
  const sourceCodeUrl =
    typeof window !== "undefined"
      ? (window as any).FORMBRICKS_SOURCE_CODE_URL || "https://github.com/ASLA1899/formbricks"
      : "https://github.com/ASLA1899/formbricks";

  return (
    <span className="flex flex-col items-center gap-1">
      <a
        href="https://formbricks.com?utm_source=survey_branding"
        target="_blank"
        tabIndex={-1}
        rel="noopener">
        <p className="text-signature text-xs">
          {t("common.powered_by")}{" "}
          <b>
            <span className="text-branding-text hover:text-signature">Formbricks</span>
          </b>
        </p>
      </a>
      <a
        href={sourceCodeUrl}
        target="_blank"
        tabIndex={-1}
        rel="noopener"
        className="text-signature text-xs hover:underline">
        Source Code (AGPL v3)
      </a>
    </span>
  );
}
