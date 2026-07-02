"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useWorkspace } from "@/app/(app)/workspaces/[workspaceId]/context/workspace-context";
import { DocumentationLinks } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/components/shareEmbedModal/documentation-links";
import { Alert, AlertButton, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";

interface DynamicPopupTabProps {
  surveyId: string;
}

export const DynamicPopupTab = ({ surveyId }: DynamicPopupTabProps) => {
  const { t } = useTranslation();
  const { workspace } = useWorkspace();

  return (
    <div className="flex h-full flex-col justify-between gap-y-4" data-testid="dynamic-popup-container">
      <Alert variant="info" size="default">
        <AlertTitle>{t("workspace.surveys.share.dynamic_popup.alert_title")}</AlertTitle>
        <AlertDescription>{t("workspace.surveys.share.dynamic_popup.alert_description")}</AlertDescription>
        <AlertButton asChild>
          <Link href={`/workspaces/${workspace?.id}/surveys/${surveyId}/edit`}>
            {t("workspace.surveys.share.dynamic_popup.alert_button")}
          </Link>
        </AlertButton>
      </Alert>

      <DocumentationLinks
        links={[
          {
            title: t("workspace.surveys.share.dynamic_popup.attribute_based_targeting"),
            href: "https://formbricks.com/docs/surveys/website-app-surveys/advanced-targeting",
          },
          {
            title: t("workspace.surveys.share.dynamic_popup.code_no_code_triggers"),
            href: "https://formbricks.com/docs/surveys/website-app-surveys/actions",
          },
          {
            title: t("workspace.surveys.share.dynamic_popup.recontact_options"),
            href: "https://formbricks.com/docs/surveys/website-app-surveys/recontact",
          },
        ]}
      />
    </div>
  );
};
