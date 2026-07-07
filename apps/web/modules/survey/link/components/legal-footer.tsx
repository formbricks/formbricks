"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";

interface LegalFooterProps {
  IMPRINT_URL?: string;
  PRIVACY_URL?: string;
  TERMS_URL?: string;
  IS_FORMBRICKS_CLOUD: boolean;
  surveyUrl: string;
  isInFlow?: boolean;
  /** Text color for the links, resolved for AA contrast against the survey background. */
  linkColor?: string;
  /** When set (non-solid backgrounds), a surface rendered behind the links for legibility. */
  backdropColor?: string;
}

export const LegalFooter = ({
  IMPRINT_URL,
  PRIVACY_URL,
  TERMS_URL,
  IS_FORMBRICKS_CLOUD,
  surveyUrl,
  isInFlow = false,
  linkColor,
  backdropColor,
}: Readonly<LegalFooterProps>) => {
  const { t } = useTranslation();
  if (!IMPRINT_URL && !PRIVACY_URL && !TERMS_URL && !IS_FORMBRICKS_CLOUD) return null;

  return (
    <footer className={cn("z-1500 w-full", isInFlow ? "shrink-0 py-4" : "absolute bottom-0 h-10")}>
      <div className="mx-auto flex h-full max-w-2xl items-center justify-center p-2 text-center text-xs">
        <div
          className={cn(
            "flex items-center justify-center text-slate-500",
            backdropColor && "rounded-md px-3 py-1"
          )}
          style={{ color: linkColor, backgroundColor: backdropColor }}>
          {IMPRINT_URL && (
            <Link href={IMPRINT_URL} target="_blank" className="hover:underline">
              {t("common.imprint")}
            </Link>
          )}
          {IMPRINT_URL && PRIVACY_URL && <span className="px-2">|</span>}
          {PRIVACY_URL && (
            <Link href={PRIVACY_URL} target="_blank" className="hover:underline">
              {t("common.privacy")}
            </Link>
          )}
          {(IMPRINT_URL || PRIVACY_URL) && TERMS_URL && <span className="px-2">|</span>}
          {TERMS_URL && (
            <Link href={TERMS_URL} target="_blank" className="hover:underline">
              {t("common.terms_of_service")}
            </Link>
          )}
          {(IMPRINT_URL || PRIVACY_URL || TERMS_URL) && IS_FORMBRICKS_CLOUD && (
            <span className="px-2">|</span>
          )}
          {IS_FORMBRICKS_CLOUD && (
            <Link
              href={`https://app.formbricks.com/s/clxbivtla014iye2vfrn436xd?surveyUrl=${surveyUrl}`}
              target="_blank"
              className="hover:underline">
              {t("common.report_survey")}
            </Link>
          )}
        </div>
      </div>
    </footer>
  );
};
