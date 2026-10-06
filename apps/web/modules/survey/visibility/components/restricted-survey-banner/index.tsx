"use client";

import { useTranslation } from "react-i18next";
import { Alert } from "@/modules/ui/components/alert";

interface RestrictedSurveyBannerProps {
  /** The author's name; `null` when the author no longer has an account. */
  ownerName: string | null;
  className?: string;
}

/**
 * Tells an organization owner or manager that they are working in a restricted survey they see only
 * through their role. The caller decides whether it applies (`showRestrictedBanner`). It is a warning
 * on purpose and cannot be dismissed, so it shows every time they open the survey.
 */
export const RestrictedSurveyBanner = ({ ownerName, className }: Readonly<RestrictedSurveyBannerProps>) => {
  const { t } = useTranslation();

  return (
    <Alert variant="warning" size="small" role="status" className={className}>
      <p className="grow">
        {ownerName
          ? t("workspace.surveys.visibility.banner_role_access", { author: ownerName })
          : t("workspace.surveys.visibility.banner_role_access_no_author")}
      </p>
    </Alert>
  );
};
