"use client";

import { DocumentationLinks } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/shareEmbedModal/documentation-links";
import { Alert, AlertButton, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { useTranslate } from "@tolgee/react";
import Link from "next/link";

interface DynamicPopupTabProps {
  environmentId: string;
  surveyId: string;
}

export const DynamicPopupTab = ({ environmentId, surveyId }: DynamicPopupTabProps) => {
  const { t } = useTranslate();

  return (
    <div className="flex h-full flex-col justify-between space-y-4" data-testid="dynamic-popup-container">
      <Alert variant="info" size="default">
        <AlertTitle>{t("environments.surveys.share.dynamic_popup.alert_title")}</AlertTitle>
        <AlertDescription>{t("environments.surveys.share.dynamic_popup.alert_description")}</AlertDescription>
        <AlertButton asChild>
          <Link href={`/environments/${environmentId}/surveys/${surveyId}/edit`}>
            {t("environments.surveys.share.dynamic_popup.alert_button")}
          </Link>
        </AlertButton>
      </Alert>

      <DocumentationLinks
        links={[
          {
            title: t("environments.surveys.share.dynamic_popup.attribute_based_targeting"),
            href: "https://formbricks.com/docs/xm-and-surveys/surveys/website-app-surveys/advanced-targeting",
          },
          {
            title: t("environments.surveys.share.dynamic_popup.code_no_code_triggers"),
            href: "https://formbricks.com/docs/xm-and-surveys/surveys/website-app-surveys/actions",
          },
          {
            title: t("environments.surveys.share.dynamic_popup.recontact_options"),
            href: "https://formbricks.com/docs/xm-and-surveys/surveys/website-app-surveys/recontact",
          },
        ]}
      />
    </div>
  );
};
