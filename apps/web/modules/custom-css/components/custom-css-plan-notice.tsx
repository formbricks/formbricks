"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { UpgradePrompt } from "@/modules/ui/components/upgrade-prompt";
import { CUSTOM_CSS_DOCS_URL } from "./lib/constants";

interface CustomCssPlanNoticeProps {
  billingHref: string | null;
  /** Saved CSS stays visible (and clearable) after a downgrade; without any, there is only the upsell. */
  hasSavedCss: boolean;
}

/**
 * Cloud without Scale (ENG-2949). With nothing saved, the card is the standard upgrade prompt. After a
 * downgrade, the saved CSS keeps applying and stays on screen read-only, so the notice explains that
 * and that clearing it still works.
 */
export const CustomCssPlanNotice = ({ billingHref, hasSavedCss }: Readonly<CustomCssPlanNoticeProps>) => {
  const { t } = useTranslation();

  if (!hasSavedCss) {
    return (
      <UpgradePrompt
        title={t("workspace.custom_css.plan_required_title")}
        description={t("workspace.custom_css.plan_required_upsell")}
        buttons={[
          { text: t("common.upgrade_plan"), href: billingHref ?? CUSTOM_CSS_DOCS_URL },
          { text: t("common.learn_more"), href: CUSTOM_CSS_DOCS_URL },
        ]}
        feature="custom_css"
      />
    );
  }

  return (
    <Alert variant="warning" role="status">
      <AlertTitle>{t("workspace.custom_css.plan_required_title")}</AlertTitle>
      <AlertDescription>
        {t("workspace.custom_css.plan_required_description")}
        {billingHref && (
          <>
            {" "}
            <Link
              href={billingHref}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline underline-offset-2">
              {t("common.upgrade_plan")}
            </Link>
          </>
        )}
      </AlertDescription>
    </Alert>
  );
};
