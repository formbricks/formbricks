import type { TFunction } from "i18next";
import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { Button } from "@/modules/ui/components/button";
import { SurveyStatusIndicator } from "@/modules/ui/components/survey-status-indicator";
import { WorkflowListActions } from "../components/workflow-list-actions";
import { WorkspaceWorkflowsSecondaryNavigation } from "../components/workspace-workflows-secondary-navigation";
import { WorkflowPageLayout } from "./workflow-page-layout";

const workflowRows = [
  {
    id: "response-completed-follow-up",
    name: "Response follow-up",
    status: "inProgress",
    statusLabel: "Enabled",
  },
  {
    id: "response-completed-draft",
    name: "Ending card follow-up",
    status: "draft",
    statusLabel: "Draft",
  },
  {
    id: "team-notification-follow-up",
    name: "Team notification",
    status: "paused",
    statusLabel: "Disabled",
  },
] as const;

interface WorkflowsListPageProps {
  isReadOnly: boolean;
  t: TFunction;
  workspaceId: string;
}

export const WorkflowsListPage = ({ isReadOnly, t, workspaceId }: Readonly<WorkflowsListPageProps>) => {
  return (
    <WorkflowPageLayout
      pageTitle={t("common.workflows")}
      navigation={
        <WorkspaceWorkflowsSecondaryNavigation activeId="workflows" t={t} workspaceId={workspaceId} />
      }
      cta={
        <Button type="button" size="sm" disabled={isReadOnly}>
          <PlusIcon />
          {t("common.new_workflow")}
        </Button>
      }>
      <div className="space-y-3">
        <div className="mt-6 grid w-full grid-cols-8 place-items-center gap-3 px-6 pr-8 text-sm text-slate-800">
          <div className="col-span-2 place-self-start">{t("common.name")}</div>
          <div className="col-span-1">{t("common.status")}</div>
          <div className="col-span-1">{t("common.created_at")}</div>
          <div className="col-span-1">{t("common.updated_at")}</div>
          <div className="col-span-2">{t("common.activity")}</div>
        </div>

        {workflowRows.map((workflow) => (
          <div key={workflow.id} className="relative block">
            <Link
              href={`/workspaces/${workspaceId}/workflows/${workflow.id}`}
              className="grid w-full grid-cols-8 place-items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 pr-8 shadow-sm transition-colors ease-in-out hover:border-slate-400">
              <div className="col-span-2 flex max-w-full items-center justify-self-start text-sm font-medium text-slate-900">
                <div className="w-full truncate">{workflow.name}</div>
              </div>
              <div
                className={cn(
                  "col-span-1 flex w-fit items-center gap-2 whitespace-nowrap rounded-full py-1 pl-1 pr-2 text-sm text-slate-800",
                  workflow.status === "inProgress" && "bg-emerald-50",
                  workflow.status === "draft" && "bg-slate-100",
                  workflow.status === "paused" && "bg-slate-100"
                )}>
                <SurveyStatusIndicator status={workflow.status} /> {workflow.statusLabel}
              </div>
              <div className="col-span-1 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm text-slate-600">
                Not set
              </div>
              <div className="col-span-1 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm text-slate-600">
                Not set
              </div>
              <div className="col-span-2 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm text-slate-600">
                Not set
              </div>
            </Link>
            <div className="absolute right-3 top-3.5">
              <WorkflowListActions workflowId={workflow.id} workspaceId={workspaceId} />
            </div>
          </div>
        ))}
      </div>
    </WorkflowPageLayout>
  );
};
