"use client";

import { useTranslation } from "react-i18next";
import type { TWorkflowTriggerType } from "@formbricks/workflows";
import { getWorkflowTriggerTypeLabel } from "@/modules/ee/workflows/lib/display";
import { Badge } from "@/modules/ui/components/badge";
import { SheetDescription, SheetHeader, SheetTitle } from "@/modules/ui/components/sheet";

interface RunDetailHeaderProps {
  workflowName: string | null;
  isDryRun: boolean;
  triggerType: TWorkflowTriggerType | null;
  /** The version the run executed; null for a Test run (the draft) or while unknown. */
  versionNumber: number | null;
  children?: React.ReactNode;
}

/** "Run · Post-call survey [Test]" over "Webhook trigger · version 3" (mock screens 7–9). */
export const RunDetailHeader = ({
  workflowName,
  isDryRun,
  triggerType,
  versionNumber,
  children,
}: Readonly<RunDetailHeaderProps>) => {
  const { t } = useTranslation();
  const trigger = triggerType ? getWorkflowTriggerTypeLabel(triggerType, t) : null;
  let source: string | null = null;
  if (isDryRun) source = t("workspace.workflows.run_test_run_of_draft");
  else if (versionNumber !== null) source = t("workspace.workflows.run_version", { version: versionNumber });

  return (
    <SheetHeader>
      <SheetTitle className="flex items-center gap-2 pr-6">
        <span className="truncate">
          {workflowName
            ? t("workspace.workflows.run_title", { name: workflowName })
            : t("common.workflow_runs")}
        </span>
        {isDryRun ? <Badge text={t("workspace.workflows.run_test_badge")} type="gray" size="tiny" /> : null}
      </SheetTitle>
      <SheetDescription>{[trigger, source].filter(Boolean).join(" · ")}</SheetDescription>
      {children}
    </SheetHeader>
  );
};
