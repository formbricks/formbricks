import type { TFunction } from "i18next";
import { Badge } from "@/modules/ui/components/badge";
import { WorkflowSecondaryNavigation } from "../components/workflow-secondary-navigation";
import { WorkflowPageLayout } from "./workflow-page-layout";

const JsonBlock = ({ value }: Readonly<{ value: unknown }>) => (
  <pre className="overflow-auto rounded-lg bg-slate-950 p-4 text-xs leading-6 text-slate-100">
    {JSON.stringify(value, null, 2)}
  </pre>
);

const sampleWorkflowRun = {
  logs: [
    {
      level: "info",
      message: "Received response.completed trigger.",
    },
    {
      level: "info",
      message: "Matched ending-card condition.",
    },
    {
      level: "info",
      message: "Queued send.email action.",
    },
  ],
  mode: "dryRun",
  responseId: "response_placeholder",
  statusLabel: "Completed",
  trigger: "response.completed",
  workflowName: "Response follow-up",
} as const;

interface WorkflowRunDetailPageProps {
  runId: string;
  t: TFunction;
  workflowId: string;
  workspaceId: string;
}

export const WorkflowRunDetailPage = ({
  runId,
  t,
  workflowId,
  workspaceId,
}: Readonly<WorkflowRunDetailPageProps>) => {
  return (
    <WorkflowPageLayout
      pageTitle={t("common.activity")}
      navigation={
        <WorkflowSecondaryNavigation
          activeId="runs"
          t={t}
          workflowId={workflowId}
          workspaceId={workspaceId}
        />
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
                <Badge text={sampleWorkflowRun.statusLabel} type="success" size="normal" />
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">{t("common.workflows")}</dt>
              <dd className="text-slate-900">{sampleWorkflowRun.workflowName}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{t("common.created_at")}</dt>
              <dd className="text-slate-900">Not set</dd>
            </div>
          </dl>
        </section>

        <section className="col-span-8 space-y-6">
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">{t("common.metadata")}</h2>
            <JsonBlock
              value={{
                mode: sampleWorkflowRun.mode,
                responseId: sampleWorkflowRun.responseId,
                trigger: sampleWorkflowRun.trigger,
                workflowId,
              }}
            />
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">{t("common.activity")}</h2>
            <JsonBlock value={sampleWorkflowRun.logs} />
          </div>
        </section>
      </div>
    </WorkflowPageLayout>
  );
};
