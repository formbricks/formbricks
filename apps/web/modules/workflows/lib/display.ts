import type { TFunction } from "i18next";
import type {
  TWorkflowRunLogStatus,
  TWorkflowRunStatus,
  TWorkflowStatus,
  TWorkflowTriggerType,
} from "@formbricks/workflows";

type TBadgeType = "warning" | "success" | "error" | "gray";

interface TStatusBadge {
  label: string;
  type: TBadgeType;
}

export const getWorkflowStatusBadge = (status: TWorkflowStatus, t: TFunction): TStatusBadge => {
  switch (status) {
    case "enabled":
      return { label: t("common.enabled"), type: "success" };
    case "disabled":
      return { label: t("common.disabled"), type: "gray" };
    case "archived":
      return { label: t("common.archived"), type: "gray" };
    case "draft":
    default:
      return { label: t("common.draft"), type: "gray" };
  }
};

export const getWorkflowRunStatusBadge = (status: TWorkflowRunStatus, t: TFunction): TStatusBadge => {
  switch (status) {
    case "completed":
      return { label: t("common.completed"), type: "success" };
    case "failed":
      return { label: t("common.failed"), type: "error" };
    case "running":
      return { label: t("common.running"), type: "warning" };
    case "canceled":
      return { label: t("common.canceled"), type: "gray" };
    case "queued":
    default:
      return { label: t("common.queued"), type: "gray" };
  }
};

export const getWorkflowRunLogStatusBadge = (status: TWorkflowRunLogStatus, t: TFunction): TStatusBadge => {
  switch (status) {
    case "succeeded":
      return { label: t("common.succeeded"), type: "success" };
    case "failed":
      return { label: t("common.failed"), type: "error" };
    case "running":
      return { label: t("common.running"), type: "warning" };
    case "skipped":
      return { label: t("common.skipped"), type: "gray" };
    case "pending":
    default:
      return { label: t("common.pending"), type: "gray" };
  }
};

export const getWorkflowTriggerTypeLabel = (triggerType: TWorkflowTriggerType, t: TFunction): string => {
  const labels: Record<TWorkflowTriggerType, string> = {
    "response.completed": t("common.response_completed"),
  };

  return labels[triggerType];
};
