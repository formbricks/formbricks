import type { TFunction } from "i18next";
import { SecondaryNavigation } from "@/modules/ui/components/secondary-navigation";

interface WorkflowSecondaryNavigationProps {
  activeId: "builder" | "runs";
  t: TFunction;
  workflowId: string;
  workspaceId: string;
}

export const WorkflowSecondaryNavigation = ({
  activeId,
  t,
  workflowId,
  workspaceId,
}: Readonly<WorkflowSecondaryNavigationProps>) => {
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
