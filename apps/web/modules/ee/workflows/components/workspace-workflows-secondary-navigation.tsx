"use client";

import { useSelectedLayoutSegment } from "next/navigation";
import { useTranslation } from "react-i18next";
import { SecondaryNavigation } from "@/modules/ui/components/secondary-navigation";

interface WorkspaceWorkflowsSecondaryNavigationProps {
  workspaceId: string;
}

export const WorkspaceWorkflowsSecondaryNavigation = ({
  workspaceId,
}: Readonly<WorkspaceWorkflowsSecondaryNavigationProps>) => {
  const { t } = useTranslation();
  // The layout renders this nav, so the active tab is derived from the child segment
  // (null = the workflows list index, "runs" = the runs tab) instead of a passed-in prop.
  const segment = useSelectedLayoutSegment();
  const activeId = segment === "runs" ? "runs" : "workflows";

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
