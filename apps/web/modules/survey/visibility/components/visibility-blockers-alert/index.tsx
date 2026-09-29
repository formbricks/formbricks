"use client";

import { useTranslation } from "react-i18next";
import { groupBlockersByType } from "@/modules/survey/visibility/lib/collaborate";
import type { TSurveyVisibilityBlocker } from "@/modules/survey/visibility/types";
import { Alert, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";

interface VisibilityBlockersAlertProps {
  blockers: readonly TSurveyVisibilityBlocker[];
}

const BlockerTypeLabel = ({ type }: Readonly<{ type: TSurveyVisibilityBlocker["type"] }>) => {
  const { t } = useTranslation();
  switch (type) {
    case "feedbackSource":
      return <>{t("workspace.surveys.visibility.feedback_sources")}</>;
    case "integration":
      return <>{t("common.integrations")}</>;
    case "webhook":
      return <>{t("common.webhooks")}</>;
    case "workflow":
      return <>{t("common.workflows")}</>;
    case "dashboard":
      return <>{t("workspace.surveys.visibility.dashboards")}</>;
  }
};

/**
 * The outbound connections that stop a survey from being restricted, grouped by type. Shared by the
 * Restrict confirmation and the Collaborate modal so both explain the refusal the same way. Renders
 * nothing without blockers.
 */
export const VisibilityBlockersAlert = ({ blockers }: Readonly<VisibilityBlockersAlertProps>) => {
  const { t } = useTranslation();
  const blockerGroups = groupBlockersByType(blockers);
  if (blockerGroups.length === 0) return null;

  return (
    <Alert variant="warning" size="default" role="status">
      <AlertTitle>{t("workspace.surveys.visibility.blocked_by_connections")}</AlertTitle>
      <AlertDescription>
        <ul className="list-disc space-y-0.5 pl-4">
          {blockerGroups.map((group) => (
            <li key={group.type}>
              <BlockerTypeLabel type={group.type} />: {group.names.join(", ")}
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
};
