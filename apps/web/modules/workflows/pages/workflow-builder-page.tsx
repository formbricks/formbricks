import type { TFunction } from "i18next";
import { PlayIcon } from "lucide-react";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { WorkflowBuilderCanvas } from "../components/workflow-builder-canvas";
import { WorkflowSecondaryNavigation } from "../components/workflow-secondary-navigation";

const sampleWorkflow = {
  name: "Response follow-up",
} as const;

interface WorkflowBuilderPageProps {
  isReadOnly: boolean;
  t: TFunction;
  workflowId: string;
  workspaceId: string;
}

export const WorkflowBuilderPage = ({
  isReadOnly,
  t,
  workflowId,
  workspaceId,
}: Readonly<WorkflowBuilderPageProps>) => {
  const disabled = isReadOnly;

  return (
    <PageContentWrapper className="space-y-4">
      <PageHeader
        pageTitle={sampleWorkflow.name}
        cta={
          <div className="flex items-center gap-2">
            <Badge text="Draft" type="gray" size="normal" />
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
        <WorkflowSecondaryNavigation
          activeId="builder"
          t={t}
          workflowId={workflowId}
          workspaceId={workspaceId}
        />
      </PageHeader>

      <WorkflowBuilderCanvas />
    </PageContentWrapper>
  );
};
