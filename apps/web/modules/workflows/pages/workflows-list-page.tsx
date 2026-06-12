import type { TFunction } from "i18next";
import { MoreVerticalIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";

const workflowRows = [
  {
    description: "Runs after a respondent completes a survey.",
    id: "response-completed-follow-up",
    name: "Response follow-up",
    statusLabel: "Enabled",
    statusType: "success",
  },
  {
    description: "Draft workflow scoped to a specific ending card.",
    id: "response-completed-draft",
    name: "Ending card follow-up",
    statusLabel: "Draft",
    statusType: "gray",
  },
  {
    description: "Example workflow for a delayed team notification.",
    id: "team-notification-follow-up",
    name: "Team notification",
    statusLabel: "Disabled",
    statusType: "gray",
  },
] as const;

interface WorkflowsListPageProps {
  isReadOnly: boolean;
  t: TFunction;
  workspaceId: string;
}

export const WorkflowsListPage = ({ isReadOnly, t, workspaceId }: Readonly<WorkflowsListPageProps>) => {
  return (
    <PageContentWrapper>
      <PageHeader
        pageTitle={t("common.workflows")}
        cta={
          <Button type="button" disabled={isReadOnly}>
            <PlusIcon />
            {t("common.create")}
          </Button>
        }
      />

      <div className="space-y-3">
        <div className="grid grid-cols-12 gap-4 px-4 text-sm font-medium text-slate-500">
          <div className="col-span-4">{t("common.name")}</div>
          <div className="col-span-2">{t("common.status")}</div>
          <div className="col-span-2">{t("common.created_at")}</div>
          <div className="col-span-2">{t("common.updated_at")}</div>
          <div className="col-span-2">{t("common.activity")}</div>
        </div>

        {workflowRows.map((workflow) => (
          <Link
            key={workflow.id}
            href={`/workspaces/${workspaceId}/workflows/${workflow.id}`}
            className="grid grid-cols-12 items-center gap-4 rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm transition-colors hover:bg-slate-50">
            <div className="col-span-4 min-w-0">
              <p className="truncate font-semibold text-slate-900">{workflow.name}</p>
              <p className="truncate text-sm text-slate-500">{workflow.description}</p>
            </div>
            <div className="col-span-2">
              <Badge text={workflow.statusLabel} type={workflow.statusType} size="normal" />
            </div>
            <div className="col-span-2 text-sm text-slate-600">Not set</div>
            <div className="col-span-2 text-sm text-slate-600">Not set</div>
            <div className="col-span-1 text-sm text-slate-600">Not set</div>
            <div className="col-span-1 flex justify-end text-slate-500">
              <MoreVerticalIcon className="h-4 w-4" aria-hidden="true" />
            </div>
          </Link>
        ))}
      </div>
    </PageContentWrapper>
  );
};
