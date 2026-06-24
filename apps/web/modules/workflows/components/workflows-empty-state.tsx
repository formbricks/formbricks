"use client";

import { WorkflowIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

interface WorkflowsEmptyStateProps {
  /** True when a search term or status filter is active (no matches) vs a genuinely empty list. */
  filtered: boolean;
}

export const WorkflowsEmptyState = ({ filtered }: Readonly<WorkflowsEmptyStateProps>) => {
  const { t } = useTranslation();

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 py-16 text-center">
      <WorkflowIcon className="size-8 text-slate-400" />
      <div className="space-y-2">
        <h3 className="text-base font-semibold text-slate-900">
          {filtered ? t("workspace.workflows.no_results_title") : t("workspace.workflows.no_workflows_title")}
        </h3>
        <p className="text-balance text-sm text-slate-600">
          {filtered
            ? t("workspace.workflows.no_results_description")
            : t("workspace.workflows.no_workflows_description")}
        </p>
      </div>
    </div>
  );
};
