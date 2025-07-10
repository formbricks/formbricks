"use client";

import { Alert, AlertButton, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { Title } from "@/modules/ui/components/title";
import { useTranslate } from "@tolgee/react";
import { ExternalLinkIcon } from "lucide-react";
import Link from "next/link";

interface DynamicPopupTabProps {
  environmentId: string;
}

interface DocumentationButtonProps {
  href: string;
  title: string;
  readDocsText: string;
}

const DocumentationButton = ({ href, title, readDocsText }: DocumentationButtonProps) => {
  return (
    <Button variant="outline" asChild>
      <Link href={href} target="_blank" className="flex w-full items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <ExternalLinkIcon className="h-4 w-4 flex-shrink-0" />
          <span className="text-left text-sm">{title}</span>
        </div>
        <span>{readDocsText}</span>
      </Link>
    </Button>
  );
};

export const DynamicPopupTab = ({ environmentId }: DynamicPopupTabProps) => {
  const { t } = useTranslate();

  return (
    <div className="flex h-full flex-col justify-between">
      <Alert variant="info" size="default">
        <AlertTitle>{t("environments.surveys.summary.dynamic_popup.alert_title")}</AlertTitle>
        <AlertDescription>
          {t("environments.surveys.summary.dynamic_popup.alert_description")}
        </AlertDescription>
        <AlertButton asChild>
          <Link href={`/environments/${environmentId}/surveys`}>
            {t("environments.surveys.summary.dynamic_popup.alert_button")}
          </Link>
        </AlertButton>
      </Alert>

      <div className="flex w-full flex-col space-y-4">
        <Title size="md">{t("environments.surveys.summary.dynamic_popup.title")}</Title>
        <DocumentationButton
          href="https://formbricks.com/docs/xm-and-surveys/surveys/website-app-surveys/advanced-targeting"
          title={t("environments.surveys.summary.dynamic_popup.attribute_based_targeting")}
          readDocsText={t("environments.surveys.summary.dynamic_popup.read_documentation")}
        />
        <DocumentationButton
          href="https://formbricks.com/docs/xm-and-surveys/surveys/website-app-surveys/actions"
          title={t("environments.surveys.summary.dynamic_popup.code_no_code_triggers")}
          readDocsText={t("environments.surveys.summary.dynamic_popup.read_documentation")}
        />
        <DocumentationButton
          href="https://formbricks.com/docs/xm-and-surveys/surveys/website-app-surveys/recontact"
          title={t("environments.surveys.summary.dynamic_popup.recontact_options")}
          readDocsText={t("environments.surveys.summary.dynamic_popup.read_documentation")}
        />
      </div>
    </div>
  );
};
