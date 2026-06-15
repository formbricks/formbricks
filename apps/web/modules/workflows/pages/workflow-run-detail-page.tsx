"use client";

import { useTranslation } from "react-i18next";
import { Badge } from "@/modules/ui/components/badge";
import { WorkflowSecondaryNavigation } from "../components/workflow-secondary-navigation";
import {
  getPlaceholderWorkflow,
  getPlaceholderWorkflowRun,
  placeholderWorkflowRuns,
} from "../lib/placeholder-data";
import { WorkflowPageLayout } from "./workflow-page-layout";

const JsonBlock = ({ value }: Readonly<{ value: unknown }>) => (
  <pre className="overflow-auto rounded-lg bg-slate-950 p-4 text-xs leading-6 text-slate-100">
    {JSON.stringify(value, null, 2)}
  </pre>
);

interface WorkflowRunDetailPageProps {
  runId: string;
  workflowId: string;
  workspaceId: string;
}

export const WorkflowRunDetailPage = ({
  runId,
  workflowId,
  workspaceId,
}: Readonly<WorkflowRunDetailPageProps>) => {
  const { t } = useTranslation();
  const workflowRun = getPlaceholderWorkflowRun(workflowId, runId) ?? placeholderWorkflowRuns[0];
  const workflow = getPlaceholderWorkflow(workflowId);

  return (
    <WorkflowPageLayout
      pageTitle={t("common.activity")}
      navigation={
        <WorkflowSecondaryNavigation activeId="runs" workflowId={workflowId} workspaceId={workspaceId} />
      }>
      <div className="grid grid-cols-12 gap-6">
        <section className="col-span-4 rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">{t("common.summary")}</h2>
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="text-slate-500">{t("common.id")}</dt>
              <dd className="font-mono text-slate-900">{runId}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{t("common.status")}</dt>
              <dd className="mt-1">
                <Badge text={workflowRun.statusLabel} type={workflowRun.statusType} size="normal" />
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">{t("common.workflows")}</dt>
              <dd className="text-slate-900">{workflow?.name ?? workflowId}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{t("common.created_at")}</dt>
              <dd className="text-slate-900">{workflowRun.createdAtLabel}</dd>
            </div>
          </dl>
        </section>

        <section className="col-span-8 space-y-6">
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">{t("common.metadata")}</h2>
            <JsonBlock
              value={{
                mode: workflowRun.mode,
                responseId: workflowRun.responseId,
                trigger: workflowRun.trigger,
                workflowId,
              }}
            />
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">{t("common.activity")}</h2>
            <JsonBlock value={workflowRun.logs} />
          </div>
        </section>
      </div>
    </WorkflowPageLayout>
  );
};
