import type { ReactNode } from "react";
import { getTranslate } from "@/lingodotdev/server";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { WorkspaceWorkflowsHeaderCta } from "@/modules/workflows/components/workspace-workflows-header-cta";
import { WorkspaceWorkflowsSecondaryNavigation } from "@/modules/workflows/components/workspace-workflows-secondary-navigation";
import { getWorkflowsRouteAuth } from "@/modules/workflows/lib/auth";
import { WorkflowsQueryClientProvider } from "./query-client-provider";

const WorkspaceWorkflowsLayout = async (
  props: Readonly<{ params: Promise<{ workspaceId: string }>; children: ReactNode }>
) => {
  const params = await props.params;
  const { isReadOnly } = await getWorkflowsRouteAuth(params.workspaceId);
  const t = await getTranslate();

  // One QueryClient for the whole (list) route group (list tab + runs tab + the header create
  // dialog), so a create/duplicate/archive/delete invalidation refreshes the shared list cache.
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
