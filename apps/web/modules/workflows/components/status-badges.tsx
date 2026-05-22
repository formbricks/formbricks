"use client";

import { PauseIcon, PencilIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TWorkflowRunStatus, TWorkflowStatus } from "@formbricks/types/workflows";
import { cn } from "@/lib/cn";
import { Badge } from "@/modules/ui/components/badge";

export const WorkflowStatusBadge = ({ status }: Readonly<{ status: TWorkflowStatus }>) => {
  const { t } = useTranslation();
  const labels = {
    draft: t("workspace.workflows.status.draft"),
    enabled: t("workspace.workflows.status.enabled"),
    disabled: t("workspace.workflows.status.disabled"),
  };
  const types = {
    draft: "gray",
    enabled: "success",
    disabled: "warning",
  } as const;

  return <Badge text={labels[status]} type={types[status]} size="normal" />;
};

export const WorkflowStatusPill = ({ status }: Readonly<{ status: TWorkflowStatus }>) => {
  const { t } = useTranslation();
  const labels = {
    draft: t("workspace.workflows.status.draft"),
    enabled: t("workspace.workflows.status.enabled"),
    disabled: t("workspace.workflows.status.disabled"),
  };

  return (
    <span
      className={cn(
        "flex w-fit items-center gap-2 whitespace-nowrap rounded-full py-1 pl-1 pr-2 text-sm text-slate-800",
        status === "enabled" && "bg-emerald-50",
        status === "draft" && "bg-slate-100",
        status === "disabled" && "bg-slate-100"
      )}>
      {status === "enabled" ? (
        <span className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping-slow rounded-full bg-green-500 opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500" />
        </span>
      ) : (
        <span
          className={cn(
            "rounded-full p-1",
            status === "draft" && "bg-slate-300",
            status === "disabled" && "bg-slate-200"
          )}>
          {status === "draft" ? (
            <PencilIcon className="h-3 w-3 text-slate-600" />
          ) : (
            <PauseIcon className="h-3 w-3 text-slate-600" />
          )}
        </span>
      )}
      {labels[status]}
    </span>
  );
};

export const WorkflowRunStatusBadge = ({ status }: Readonly<{ status: TWorkflowRunStatus }>) => {
  const { t } = useTranslation();
  const labels = {
    queued: t("workspace.workflows.run_status.queued"),
    running: t("workspace.workflows.run_status.running"),
    completed: t("workspace.workflows.run_status.completed"),
    failed: t("workspace.workflows.run_status.failed"),
    canceled: t("workspace.workflows.run_status.canceled"),
  };
  const types = {
    queued: "gray",
    running: "warning",
    completed: "success",
    failed: "error",
    canceled: "gray",
  } as const;

  return <Badge text={labels[status]} type={types[status]} size="normal" />;
};
