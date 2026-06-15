"use client";

import { PlayIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { WorkflowBuilderCanvas } from "../components/workflow-builder-canvas";
import { WorkflowSecondaryNavigation } from "../components/workflow-secondary-navigation";
import { getPlaceholderWorkflow, placeholderWorkflowBuilderBadge } from "../lib/placeholder-data";

interface WorkflowBuilderPageProps {
  isReadOnly: boolean;
  workflowId: string;
  workspaceId: string;
}

export const WorkflowBuilderPage = ({
  isReadOnly,
  workflowId,
  workspaceId,
}: Readonly<WorkflowBuilderPageProps>) => {
  const { t } = useTranslation();
  const disabled = isReadOnly;
  const workflow = getPlaceholderWorkflow(workflowId);

  return (
    <PageContentWrapper className="space-y-4">
      <PageHeader
        pageTitle={workflow?.name ?? workflowId}
        cta={
          <div className="flex items-center gap-2">
            <Badge
              text={placeholderWorkflowBuilderBadge.label}
              type={placeholderWorkflowBuilderBadge.type}
              size="normal"
            />
            <Button type="button" variant="secondary" size="sm" disabled={disabled}>
              <PlayIcon />
              {t("common.test")}
            </Button>
            <Button type="button" variant="secondary" size="sm" disabled={disabled}>
              {t("common.save")}
            </Button>
            <Button type="button" size="sm" disabled={disabled}>
              {t("common.enable")}
            </Button>
          </div>
        }>
        <WorkflowSecondaryNavigation activeId="builder" workflowId={workflowId} workspaceId={workspaceId} />
      </PageHeader>

      <WorkflowBuilderCanvas />
    </PageContentWrapper>
  );
};
