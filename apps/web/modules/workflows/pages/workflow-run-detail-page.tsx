"use client";

import { RefreshCcwIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatDateTimeForDisplay } from "@/lib/utils/datetime";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { Button } from "@/modules/ui/components/button";
import { CodeBlock } from "@/modules/ui/components/code-block";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { WorkflowRunStatusBadge } from "../components/status-badges";
import { WorkflowSecondaryNavigation } from "../components/workflow-secondary-navigation";
import { getWorkflowRun } from "../lib/api-client";
import { WorkflowRunDetailLoading } from "../loading";
import type { TWorkflowRun } from "../types/workflows";

const JsonBlock = ({ value }: Readonly<{ value: unknown }>) => (
  <CodeBlock language="json" noMargin>
    {JSON.stringify(value, null, 2)}
  </CodeBlock>
);

export const WorkflowRunDetailPage = ({
  workspaceId,
  workflowId,
  runId,
}: Readonly<{ workspaceId: string; workflowId: string; runId: string }>) => {
  const { t, i18n } = useTranslation();
  const [run, setRun] = useState<TWorkflowRun | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRun = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getWorkflowRun(workflowId, runId);
      setRun(result);
    } catch (loadError) {
      setError(getV3ApiErrorMessage(loadError, t("common.something_went_wrong_please_try_again")));
    } finally {
      setIsLoading(false);
    }
  }, [workflowId, runId, t]);

  useEffect(() => {
    void loadRun();
  }, [loadRun]);

  if (isLoading) {
    return <WorkflowRunDetailLoading />;
  }

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("workspace.workflows.run_detail")}>
        <WorkflowSecondaryNavigation workspaceId={workspaceId} workflowId={workflowId} activeId="runs" />
      </PageHeader>

      {error || !run ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-slate-200 bg-white py-16 text-slate-600">
          <p>{error ?? t("common.something_went_wrong_please_try_again")}</p>
          <Button size="sm" variant="secondary" onClick={loadRun}>
            {t("common.try_again")}
            <RefreshCcwIcon />
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-6">
          <section className="col-span-4 space-y-4 rounded-lg border border-slate-200 bg-white p-4">
            <div>
              <p className="text-xs font-medium uppercase text-slate-500">{t("common.status")}</p>
              <div className="mt-2">
                <WorkflowRunStatusBadge status={run.status} />
              </div>
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-slate-500">{t("common.created_at")}</p>
              <p className="mt-1 text-sm text-slate-800">
                {formatDateTimeForDisplay(new Date(run.createdAt), i18n.resolvedLanguage)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-slate-500">
                {t("workspace.workflows.response")}
              </p>
              <p className="mt-1 break-all text-sm text-slate-800">{run.responseId ?? t("common.none")}</p>
            </div>
            {run.error ? (
              <div>
                <p className="text-xs font-medium uppercase text-slate-500">
                  {t("workspace.workflows.error")}
                </p>
                <p className="mt-1 text-sm text-red-700">{run.error}</p>
              </div>
            ) : null}
          </section>

          <section className="col-span-8 space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-slate-800">
                {t("workspace.workflows.trigger_payload")}
              </h2>
              <div className="mt-3">
                <JsonBlock value={run.triggerPayload} />
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-slate-800">
                {t("workspace.workflows.step_outputs")}
              </h2>
              <div className="mt-3 space-y-3">
                {run.data.steps.map((step) => (
                  <div
                    key={`${step.nodeId}-${step.startedAt}`}
                    className="rounded-md border border-slate-200 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-800">{step.nodeId}</p>
                      <span className="text-xs text-slate-500">{step.status}</span>
                    </div>
                    <JsonBlock value={{ input: step.input, output: step.output, error: step.error }} />
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}
    </PageContentWrapper>
  );
};
