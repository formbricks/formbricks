"use client";

import { PlayIcon } from "lucide-react";
import { useSelectedLayoutSegment } from "next/navigation";
import { useTranslation } from "react-i18next";
import type { TWorkflowStatus } from "@formbricks/workflows";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import { getWorkflowStatusBadge } from "../lib/display";

interface WorkflowHeaderCtaProps {
  isReadOnly: boolean;
  status: TWorkflowStatus;
}

export const WorkflowHeaderCta = ({ isReadOnly, status }: Readonly<WorkflowHeaderCtaProps>) => {
  const { t } = useTranslation();
  // Builder actions only belong to the edit tab (the index segment); the runs tab has no CTA.
  const segment = useSelectedLayoutSegment();

  if (segment !== null) {
    return null;
  }

  const statusBadge = getWorkflowStatusBadge(status, t);

  return (
    <div className="flex items-center gap-2">
      <Badge text={statusBadge.label} type={statusBadge.type} size="normal" />
      <Button type="button" variant="secondary" size="sm" disabled={isReadOnly}>
        <PlayIcon />
        {t("common.test")}
      </Button>
      <Button type="button" variant="secondary" size="sm" disabled={isReadOnly}>
        {t("common.save")}
      </Button>
      <Button type="button" size="sm" disabled={isReadOnly}>
        {t("common.enable")}
      </Button>
    </div>
  );
};
