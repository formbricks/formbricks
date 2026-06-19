"use client";

import { useSelectedLayoutSegment } from "next/navigation";
import { useTranslation } from "react-i18next";
import type { TWorkflowStatus } from "@formbricks/workflows";
import { Badge } from "@/modules/ui/components/badge";
import { getWorkflowStatusBadge } from "@/modules/workflows/lib/display";

interface WorkflowHeaderCtaProps {
  isReadOnly: boolean;
  status: TWorkflowStatus;
}

export const WorkflowHeaderCta = ({ isReadOnly: _isReadOnly, status }: Readonly<WorkflowHeaderCtaProps>) => {
  const { t } = useTranslation();
  const segment = useSelectedLayoutSegment();

  if (segment !== null) {
    return null;
  }

  const statusBadge = getWorkflowStatusBadge(status, t);

  return <Badge text={statusBadge.label} type={statusBadge.type} size="normal" />;
};
