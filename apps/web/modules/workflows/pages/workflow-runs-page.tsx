"use client";

import { RefreshCcwIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { Button } from "@/modules/ui/components/button";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { WorkflowRunsTable } from "../components/workflow-runs-table";
import { WorkflowSecondaryNavigation } from "../components/workflow-secondary-navigation";
import { listWorkflowRuns } from "../lib/api-client";
import { WorkflowRunsLoading } from "../loading";
import type { TWorkflowRun } from "../types/workflows";

export const WorkflowRunsPage = ({
  workspaceId,
  workflowId,
}: Readonly<{ workspaceId: string; workflowId: string }>) => {
  const { t } = useTranslation();
  const [runs, setRuns] = useState<TWorkflowRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRuns = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await listWorkflowRuns({ workflowId });
      setRuns(result.data);
    } catch (loadError) {
      setError(getV3ApiErrorMessage(loadError, t("common.something_went_wrong_please_try_again")));
    } finally {
      setIsLoading(false);
    }
  }, [workflowId, t]);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  if (isLoading) {
    return <WorkflowRunsLoading />;
  }

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("workspace.workflows.runs")}>
        <WorkflowSecondaryNavigation workspaceId={workspaceId} workflowId={workflowId} activeId="runs" />
      </PageHeader>

      {error ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-slate-200 bg-white py-16 text-slate-600">
          <p>{error}</p>
          <Button size="sm" variant="secondary" onClick={loadRuns}>
            {t("common.try_again")}
            <RefreshCcwIcon />
          </Button>
        </div>
      ) : runs.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white py-16 text-center text-sm text-slate-500">
          {t("workspace.workflows.no_runs")}
        </div>
      ) : (
        <WorkflowRunsTable runs={runs} workspaceId={workspaceId} workflowId={workflowId} />
      )}
    </PageContentWrapper>
  );
};
