"use client";

import {
  CopyIcon,
  GitBranchIcon,
  MoreVerticalIcon,
  PlusIcon,
  RefreshCcwIcon,
  SquarePenIcon,
  TrashIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { timeSince } from "@/lib/time";
import { formatDateForDisplay, formatDateTimeForDisplay } from "@/lib/utils/datetime";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { Button } from "@/modules/ui/components/button";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { CreateWorkflowDialog } from "../components/create-workflow-dialog";
import { WorkflowStatusPill } from "../components/status-badges";
import { createWorkflow, deleteWorkflow, listWorkflows } from "../lib/api-client";
import { createDefaultWorkflowDefinition } from "../lib/default-workflow";
import { WorkflowsListLoading } from "../loading";
import type { TWorkflow } from "../types/workflows";

const formatWorkflowLastRunAt = (workflow: TWorkflow, locale: string, emptyLabel: string): string => {
  const lastRunAt =
    workflow.lastRun?.finishedAt ?? workflow.lastRun?.startedAt ?? workflow.lastRun?.createdAt;
  return lastRunAt ? formatDateTimeForDisplay(new Date(lastRunAt), locale) : emptyLabel;
};

type TWorkflowRowMenuProps = Readonly<{
  workflow: TWorkflow;
  workspaceId: string;
  isReadOnly: boolean;
  onDelete: (workflowId: string) => Promise<void>;
}>;

const WorkflowRowMenu = ({ workflow, workspaceId, isReadOnly, onDelete }: TWorkflowRowMenuProps) => {
  const { t } = useTranslation();
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDropDownOpen, setIsDropDownOpen] = useState(false);
  const editHref = `/workspaces/${workspaceId}/workflows/${workflow.id}`;

  const handleDeleteWorkflow = async () => {
    setIsDeleting(true);
    try {
      await onDelete(workflow.id);
      setDeleteDialogOpen(false);
    } catch (error) {
      toast.error(getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again")));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div id={`${workflow.name.toLowerCase().split(" ").join("-")}-workflow-actions`}>
      <DropdownMenu open={isDropDownOpen} onOpenChange={setIsDropDownOpen}>
        <DropdownMenuTrigger className="z-10" asChild>
          <button
            type="button"
            aria-label={t("common.open_options")}
            className="rounded-lg border bg-white p-2 hover:bg-slate-50">
            <span className="sr-only">{t("common.open_options")}</span>
            <MoreVerticalIcon className="h-4 w-4" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="inline-block w-auto min-w-max" align="end">
          <DropdownMenuGroup>
            <DropdownMenuItem>
              <Link className="flex w-full items-center" href={editHref}>
                <SquarePenIcon className="mr-2 size-4" />
                {t("common.edit")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <button type="button" className="flex w-full cursor-not-allowed items-center" disabled>
                <CopyIcon className="mr-2 size-4" />
                {t("common.duplicate")}
              </button>
            </DropdownMenuItem>
            <DropdownMenuItem disabled={isReadOnly}>
              <button
                type="button"
                className={cn("flex w-full items-center", isReadOnly && "cursor-not-allowed opacity-50")}
                disabled={isReadOnly}
                onClick={(event) => {
                  event.preventDefault();
                  setIsDropDownOpen(false);
                  setDeleteDialogOpen(true);
                }}>
                <TrashIcon className="mr-2 h-4 w-4" />
                {t("common.delete")}
              </button>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {!isReadOnly ? (
        <DeleteDialog
          deleteWhat={workflow.name}
          open={isDeleteDialogOpen}
          setOpen={setDeleteDialogOpen}
          onDelete={handleDeleteWorkflow}
          isDeleting={isDeleting}
        />
      ) : null}
    </div>
  );
};

export const WorkflowsListPage = ({
  workspaceId,
  isReadOnly,
}: Readonly<{ workspaceId: string; isReadOnly: boolean }>) => {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const locale = i18n.resolvedLanguage ?? "en-US";
  const [workflows, setWorkflows] = useState<TWorkflow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [workflowName, setWorkflowName] = useState("");
  const [workflowDescription, setWorkflowDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadWorkflows = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await listWorkflows({ workspaceId });
      setWorkflows(result.data);
    } catch (loadError) {
      setError(getV3ApiErrorMessage(loadError, t("common.something_went_wrong_please_try_again")));
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, t]);

  useEffect(() => {
    void loadWorkflows();
  }, [loadWorkflows]);

  const handleCreateDialogOpenChange = (open: boolean) => {
    setIsCreateDialogOpen(open);
    if (!open) {
      setWorkflowName("");
      setWorkflowDescription("");
    }
  };

  const handleCreateWorkflow = async () => {
    const trimmedWorkflowName = workflowName.trim();
    if (!trimmedWorkflowName) {
      toast.error(t("workspace.workflows.please_enter_name"));
      return;
    }

    setIsCreating(true);
    try {
      const workflow = await createWorkflow({
        workspaceId,
        name: trimmedWorkflowName,
        description: workflowDescription.trim() || null,
        definition: createDefaultWorkflowDefinition(),
      });
      toast.success(t("workspace.workflows.create_success"));
      handleCreateDialogOpenChange(false);
      router.push(`/workspaces/${workspaceId}/workflows/${workflow.id}`);
    } catch (createError) {
      toast.error(getV3ApiErrorMessage(createError, t("workspace.workflows.create_failed")));
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteWorkflow = async (workflowId: string) => {
    await deleteWorkflow(workflowId);
    setWorkflows((currentWorkflows) => currentWorkflows.filter((workflow) => workflow.id !== workflowId));
  };

  const createButton = isReadOnly ? undefined : (
    <Button size="sm" onClick={() => handleCreateDialogOpenChange(true)}>
      {t("workspace.workflows.create_workflow")}
      <PlusIcon />
    </Button>
  );

  if (isLoading) {
    return <WorkflowsListLoading />;
  }

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.workflows")} cta={createButton} />
      {!isReadOnly ? (
        <CreateWorkflowDialog
          open={isCreateDialogOpen}
          onOpenChange={handleCreateDialogOpenChange}
          workflowName={workflowName}
          workflowDescription={workflowDescription}
          onWorkflowNameChange={setWorkflowName}
          onWorkflowDescriptionChange={setWorkflowDescription}
          onCreate={handleCreateWorkflow}
          isCreating={isCreating}
        />
      ) : null}

      {error ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-slate-200 bg-white py-16 text-slate-600">
          <p>{error}</p>
          <Button size="sm" variant="secondary" onClick={loadWorkflows}>
            {t("common.try_again")}
            <RefreshCcwIcon />
          </Button>
        </div>
      ) : workflows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-slate-200 bg-white py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
            <GitBranchIcon />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-800">{t("workspace.workflows.no_workflows")}</h2>
            <p className="mt-1 text-sm text-slate-500">{t("workspace.workflows.no_workflows_description")}</p>
          </div>
          {createButton}
        </div>
      ) : (
        <div className="flex-col space-y-3">
          <div className="mt-6 grid w-full grid-cols-10 place-items-center gap-3 px-6 pr-8 text-sm text-slate-800">
            <div className="col-span-3 place-self-start">{t("common.name")}</div>
            <div className="col-span-2">{t("common.status")}</div>
            <div className="col-span-2">{t("common.created_at")}</div>
            <div className="col-span-1">{t("common.updated_at")}</div>
            <div className="col-span-2">{t("workspace.workflows.last_run")}</div>
          </div>
          {workflows.map((workflow) => (
            <div key={workflow.id} className="relative block">
              <Link href={`/workspaces/${workspaceId}/workflows/${workflow.id}`} className="block">
                <div className="grid w-full grid-cols-10 place-items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 pr-8 shadow-sm transition-colors ease-in-out hover:border-slate-400">
                  <div className="col-span-3 flex max-w-full items-center justify-self-start text-sm font-medium text-slate-900">
                    <div className="min-w-0">
                      <div className="truncate">{workflow.name}</div>
                      {workflow.description ? (
                        <div className="mt-1 truncate text-xs font-normal text-slate-500">
                          {workflow.description}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="col-span-2 flex max-w-full items-center">
                    <WorkflowStatusPill status={workflow.status} />
                  </div>
                  <div className="col-span-2 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm text-slate-600">
                    {formatDateForDisplay(new Date(workflow.createdAt), locale)}
                  </div>
                  <div className="col-span-1 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm text-slate-600">
                    {timeSince(workflow.updatedAt, locale)}
                  </div>
                  <div className="col-span-2 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm text-slate-600">
                    {formatWorkflowLastRunAt(workflow, locale, t("common.none"))}
                  </div>
                </div>
              </Link>
              <div className="absolute right-3 top-3.5">
                <WorkflowRowMenu
                  workflow={workflow}
                  workspaceId={workspaceId}
                  isReadOnly={isReadOnly}
                  onDelete={handleDeleteWorkflow}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </PageContentWrapper>
  );
};
