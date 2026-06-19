"use client";

import { useTranslation } from "react-i18next";
import type { TWorkflowStatus } from "@formbricks/workflows";
import { Badge } from "@/modules/ui/components/badge";
import { getWorkflowStatusBadge } from "../lib/display";

interface WorkflowStatusPillProps {
  status: TWorkflowStatus;
}

/**
 * Shared status pill for all four workflow lifecycle states (draft, enabled, disabled, archived).
 * Label + color come from the single `getWorkflowStatusBadge` source of truth in `lib/display.ts`,
 * rendered through the dashboard `Badge` primitive so the list and (later) editor stay consistent.
 */
export const WorkflowStatusPill = ({ status }: Readonly<WorkflowStatusPillProps>) => {
  const { t } = useTranslation();
  const badge = getWorkflowStatusBadge(status, t);

  return <Badge text={badge.label} type={badge.type} size="tiny" />;
};
