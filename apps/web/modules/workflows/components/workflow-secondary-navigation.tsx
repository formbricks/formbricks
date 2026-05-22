"use client";

import { useTranslation } from "react-i18next";
import { SecondaryNavigation } from "@/modules/ui/components/secondary-navigation";

export const WorkflowSecondaryNavigation = ({
  workspaceId,
  workflowId,
  activeId,
}: Readonly<{
  workspaceId: string;
  workflowId: string;
  activeId: "builder" | "runs";
}>) => {
  const { t } = useTranslation();

  return (
    <SecondaryNavigation
      activeId={activeId}
      navigation={[
        {
          id: "builder",
          label: t("workspace.workflows.builder"),
          href: `/workspaces/${workspaceId}/workflows/${workflowId}`,
        },
        {
          id: "runs",
          label: t("workspace.workflows.runs"),
          href: `/workspaces/${workspaceId}/workflows/${workflowId}/runs`,
        },
      ]}
    />
  );
};
