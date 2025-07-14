"use client";

import { TabContainer } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/shareEmbedModal/TabContainer";
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
    <TabContainer
      title={t("environments.surveys.share.dynamic_popup.title")}
      description={t("environments.surveys.share.dynamic_popup.description")}>
      <div className="flex h-full flex-col justify-between space-y-4">
        <Alert variant="info" size="default">
          <AlertTitle>{t("environments.surveys.share.dynamic_popup.alert_title")}</AlertTitle>
          <AlertDescription>
            {t("environments.surveys.share.dynamic_popup.alert_description")}
          </AlertDescription>
          <AlertButton asChild>
            <Link href={`/environments/${environmentId}/surveys/${surveyId}/edit`}>
              {t("environments.surveys.share.dynamic_popup.alert_button")}
            </Link>
          </AlertButton>
        </Alert>

        <div className="flex w-full flex-col gap-2">
          {[
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
          ].map((link, index) => (
            <Alert key={index} variant="outbound" size="small">
              <AlertTitle>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-900 hover:underline">
                  {link.title}
                </a>
              </AlertTitle>
              <AlertButton asChild>
                <a href={link.href} target="_blank" rel="noopener noreferrer">
                  {t("environments.surveys.share.dynamic_popup.read_documentation")}
                </a>
              </AlertButton>
            </Alert>
          ))}
        </div>
      </div>
    </TabContainer>
  );
};
