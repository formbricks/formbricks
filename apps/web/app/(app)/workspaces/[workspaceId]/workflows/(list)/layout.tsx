import type { ReactNode } from "react";
import { getTranslate } from "@/lingodotdev/server";
import { WorkspaceWorkflowsHeaderCta } from "@/modules/ee/workflows/components/workspace-workflows-header-cta";
import { WorkspaceWorkflowsSecondaryNavigation } from "@/modules/ee/workflows/components/workspace-workflows-secondary-navigation";
import { getWorkflowsRouteAuth } from "@/modules/ee/workflows/lib/auth";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { WorkflowsQueryClientProvider } from "./query-client-provider";

const WorkspaceWorkflowsLayout = async (
  props: Readonly<{ params: Promise<{ workspaceId: string }>; children: ReactNode }>
) => {
  const params = await props.params;
  const { isReadOnly } = await getWorkflowsRouteAuth(params.workspaceId);
  const t = await getTranslate();

  return (
    <WorkflowsQueryClientProvider>
      <PageContentWrapper>
        <PageHeader
          pageTitle={t("common.workflows")}
          cta={<WorkspaceWorkflowsHeaderCta workspaceId={params.workspaceId} isReadOnly={isReadOnly} />}>
          <WorkspaceWorkflowsSecondaryNavigation workspaceId={params.workspaceId} />
        </PageHeader>
        {props.children}
      </PageContentWrapper>
    </WorkflowsQueryClientProvider>
  );
};

export default WorkspaceWorkflowsLayout;
