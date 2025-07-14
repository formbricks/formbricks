"use client";

import { Alert, AlertButton, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { useTranslate } from "@tolgee/react";
import Link from "next/link";
import { DocumentationLinksSection } from "./documentation-links-section";

interface DynamicPopupTabProps {
  environmentId: string;
  surveyId: string;
}

export const DynamicPopupTab = ({ environmentId, surveyId }: DynamicPopupTabProps) => {
  const { t } = useTranslate();

  const documentationLinks = [
    {
      href: "https://formbricks.com/docs/xm-and-surveys/surveys/website-app-surveys/advanced-targeting",
      title: t("environments.surveys.summary.dynamic_popup.attribute_based_targeting"),
    },
    {
      href: "https://formbricks.com/docs/xm-and-surveys/surveys/website-app-surveys/actions",
      title: t("environments.surveys.summary.dynamic_popup.code_no_code_triggers"),
    },
    {
      href: "https://formbricks.com/docs/xm-and-surveys/surveys/website-app-surveys/recontact",
      title: t("environments.surveys.summary.dynamic_popup.recontact_options"),
    },
  ];

  return (
    <div className="flex h-full flex-col justify-between space-y-4">
      <Alert variant="info" size="default">
        <AlertTitle>{t("environments.surveys.summary.dynamic_popup.alert_title")}</AlertTitle>
        <AlertDescription>
          {t("environments.surveys.summary.dynamic_popup.alert_description")}
        </AlertDescription>
        <AlertButton asChild>
          <Link href={`/environments/${environmentId}/surveys/${surveyId}/edit`}>
            {t("environments.surveys.summary.dynamic_popup.alert_button")}
          </Link>
        </AlertButton>
      </Alert>

      <DocumentationLinksSection
        title={t("environments.surveys.summary.dynamic_popup.title")}
        links={documentationLinks}
      />
    </div>
  );
};
