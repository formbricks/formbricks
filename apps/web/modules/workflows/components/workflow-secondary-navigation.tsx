"use client";

import { useSelectedLayoutSegment } from "next/navigation";
import { useTranslation } from "react-i18next";
import { SecondaryNavigation } from "@/modules/ui/components/secondary-navigation";

interface WorkflowSecondaryNavigationProps {
  workflowId: string;
  workspaceId: string;
}

export const WorkflowSecondaryNavigation = ({
  workflowId,
  workspaceId,
}: Readonly<WorkflowSecondaryNavigationProps>) => {
  const { t } = useTranslation();
  // The layout renders this nav, so the active tab is derived from the child segment
  // (null = the builder/edit index, "runs" = the runs tab) instead of a passed-in prop.
  const segment = useSelectedLayoutSegment();
  const activeId = segment === "runs" ? "runs" : "builder";

  const navigation = [
    {
      id: "builder",
      label: t("common.edit"),
      href: `/workspaces/${workspaceId}/workflows/${workflowId}`,
    },
    {
      id: "runs",
      label: t("common.runs"),
      href: `/workspaces/${workspaceId}/workflows/${workflowId}/runs`,
    },
  ];

  return <SecondaryNavigation navigation={navigation} activeId={activeId} />;
};
