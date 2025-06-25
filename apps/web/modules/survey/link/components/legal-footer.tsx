"use client";

import { useTranslate } from "@tolgee/react";
import Link from "next/link";

interface LegalFooterProps {
  IMPRINT_URL?: string;
  PRIVACY_URL?: string;
  IS_FORMBRICKS_CLOUD: boolean;
  surveyUrl: string;
}

export const LegalFooter = ({
  IMPRINT_URL,
  PRIVACY_URL,
  IS_FORMBRICKS_CLOUD,
  surveyUrl,
}: LegalFooterProps) => {
  const { t } = useTranslate();
  if (!IMPRINT_URL && !PRIVACY_URL && !IS_FORMBRICKS_CLOUD) return null;

  return (
    <div className="absolute bottom-0 z-[1500] h-10 w-full" role="contentinfo">
      <div className="mx-auto flex h-full max-w-2xl items-center justify-center p-2 text-center text-xs text-slate-500">
        {IMPRINT_URL && (
          <Link href={IMPRINT_URL} target="_blank" className="hover:underline" tabIndex={-1}>
            {t("common.imprint")}
          </Link>
        )}
        {IMPRINT_URL && PRIVACY_URL && <span className="px-2">|</span>}
        {PRIVACY_URL && (
          <Link href={PRIVACY_URL} target="_blank" className="hover:underline" tabIndex={-1}>
            {t("common.privacy")}
          </Link>
        )}
        {PRIVACY_URL && IS_FORMBRICKS_CLOUD && <span className="px-2">|</span>}
        {IS_FORMBRICKS_CLOUD && (
          <Link
            href={`https://app.formbricks.com/s/clxbivtla014iye2vfrn436xd?surveyUrl=${surveyUrl}`}
            target="_blank"
            className="hover:underline"
            tabIndex={-1}>
            {t("common.report_survey")}
          </Link>
        )}
      </div>
    </div>
  );
};
