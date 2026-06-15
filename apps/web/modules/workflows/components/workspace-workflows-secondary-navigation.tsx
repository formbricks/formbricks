"use client";

import { useTranslation } from "react-i18next";
import { SecondaryNavigation } from "@/modules/ui/components/secondary-navigation";

interface WorkspaceWorkflowsSecondaryNavigationProps {
  activeId: "workflows" | "runs";
  workspaceId: string;
}

export const WorkspaceWorkflowsSecondaryNavigation = ({
  activeId,
  workspaceId,
}: Readonly<WorkspaceWorkflowsSecondaryNavigationProps>) => {
  const { t } = useTranslation();

  const navigation = [
    {
      id: "workflows",
      label: t("common.workflows"),
      href: `/workspaces/${workspaceId}/workflows`,
    },
    {
      id: "runs",
      label: t("common.runs"),
      href: `/workspaces/${workspaceId}/workflows/runs`,
    },
  ];

  return <SecondaryNavigation navigation={navigation} activeId={activeId} />;
};
