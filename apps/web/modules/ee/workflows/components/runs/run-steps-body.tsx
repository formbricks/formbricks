"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { TWorkflowDefinition } from "@formbricks/workflows";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { toRunDetailRows } from "@/modules/ee/workflows/lib/run-detail-rows";
import { type TWorkflowRunDetail } from "@/modules/ee/workflows/types";
import { Skeleton } from "@/modules/ui/components/skeleton";
import { RunDetailSteps } from "./run-detail-steps";

interface RunStepsBodyProps {
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  detail?: TWorkflowRunDetail;
  /** Names steps and conditions; null when the workflow could not be loaded. */
  definition: TWorkflowDefinition | null;
}

// Step list body: one early return per fetch state keeps this flat (no nested ternary).
export const RunStepsBody = ({
  isLoading,
  isError,
  error,
  detail,
  definition,
}: Readonly<RunStepsBodyProps>) => {
  const { t } = useTranslation();
  const rows = useMemo(() => (detail ? toRunDetailRows(detail, definition) : null), [detail, definition]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-sm text-slate-600">
        {getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again"))}
      </p>
    );
  }

  if (detail && rows) {
    return <RunDetailSteps rows={rows} responseId={detail.responseId} />;
  }

  return null;
};
