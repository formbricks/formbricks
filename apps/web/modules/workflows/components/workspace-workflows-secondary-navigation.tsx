import type { TFunction } from "i18next";
import { SecondaryNavigation } from "@/modules/ui/components/secondary-navigation";

interface WorkspaceWorkflowsSecondaryNavigationProps {
  activeId: "workflows" | "runs";
  t: TFunction;
  workspaceId: string;
}

export const WorkspaceWorkflowsSecondaryNavigation = ({
  activeId,
  t,
  workspaceId,
}: Readonly<WorkspaceWorkflowsSecondaryNavigationProps>) => {
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
