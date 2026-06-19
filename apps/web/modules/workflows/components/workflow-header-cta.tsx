"use client";

import { useAtomValue } from "jotai";
import { ArchiveIcon, ArchiveRestoreIcon } from "lucide-react";
import { useSelectedLayoutSegment } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import { useWorkflowBuilder } from "@/modules/workflows/hooks/use-workflow-builder";
import { getWorkflowStatusBadge } from "@/modules/workflows/lib/display";
import { workflowAtom } from "@/modules/workflows/state/editor";

interface WorkflowHeaderCtaProps {
  workflowId: string;
  isReadOnly: boolean;
}

/**
 * Page-header CTA for the workflow detail layout — renders the live status badge plus the
 * Archive (or Unarchive) and Save buttons. Hidden on the runs tab. Shares state with the builder
 * page through the Jotai store wrapping the layout, so the badge and button spinners stay in
 * sync with edits happening below.
 */
export const WorkflowHeaderCta = ({ workflowId, isReadOnly }: Readonly<WorkflowHeaderCtaProps>) => {
  const { t } = useTranslation();
  const segment = useSelectedLayoutSegment();
  const workflow = useAtomValue(workflowAtom);
  const builder = useWorkflowBuilder({ workflowId, isReadOnly, loadOnMount: false });

  // Only the edit tab gets the lifecycle controls — the runs tab is read-only.
  if (segment !== null) return null;
  if (!workflow) return null;

  const statusBadge = getWorkflowStatusBadge(workflow.status, t);
  const isArchived = workflow.status === "archived";

  return (
    <div className="flex items-center gap-2">
      <Badge text={statusBadge.label} type={statusBadge.type} size="normal" />
      {isArchived ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={builder.unarchive}
          loading={builder.isTransitioning}>
          <ArchiveRestoreIcon />
          {t("common.unarchive")}
        </Button>
      ) : (
        <>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={builder.archive}
            loading={builder.isTransitioning}>
            <ArchiveIcon />
            {t("common.archive")}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={builder.save}
            loading={builder.isSaving}
            disabled={!builder.canEdit}>
            {t("common.save")}
          </Button>
        </>
      )}
    </div>
  );
};
