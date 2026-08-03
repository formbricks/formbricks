"use client";

import { useTranslation } from "react-i18next";
import type { TWorkflowStatus } from "@formbricks/workflows";
import { Badge } from "@/modules/ui/components/badge";
import { getWorkflowStatusBadge } from "../lib/display";

interface WorkflowStatusPillProps {
  status: TWorkflowStatus;
  size?: "tiny" | "normal" | "large";
}

export const WorkflowStatusPill = ({ status, size = "tiny" }: Readonly<WorkflowStatusPillProps>) => {
  const { t } = useTranslation();
  const badge = getWorkflowStatusBadge(status, t);

  return <Badge text={badge.label} type={badge.type} size={size} />;
};
