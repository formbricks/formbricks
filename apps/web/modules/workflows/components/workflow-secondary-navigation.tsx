"use client";

import { useTranslation } from "react-i18next";
import { SecondaryNavigation } from "@/modules/ui/components/secondary-navigation";

interface WorkflowSecondaryNavigationProps {
  activeId: "builder" | "runs";
  workflowId: string;
  workspaceId: string;
}

export const WorkflowSecondaryNavigation = ({
  activeId,
  workflowId,
  workspaceId,
}: Readonly<WorkflowSecondaryNavigationProps>) => {
  const { t } = useTranslation();

  const navigation = [
    {
      id: "builder",
      label: t("common.edit"),
      href: `/workspaces/${workspaceId}/workflows/${workflowId}`,
    },
    {
      id: "runs",
      label: t("common.activity"),
      href: `/workspaces/${workspaceId}/workflows/${workflowId}/runs`,
    },
  ];

  return <SecondaryNavigation navigation={navigation} activeId={activeId} />;
};
