"use client";

import { useTranslation } from "react-i18next";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { type TWorkflowRunDetail } from "@/modules/ee/workflows/types";
import { Skeleton } from "@/modules/ui/components/skeleton";
import { WorkflowRunSteps } from "./workflow-run-steps";

interface RunStepsBodyProps {
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  detail?: TWorkflowRunDetail;
}

// Step-logs section body: one early return per fetch state keeps this flat (no nested ternary).
export const RunStepsBody = ({ isLoading, isError, error, detail }: Readonly<RunStepsBodyProps>) => {
  const { t } = useTranslation();

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

  if (detail) {
    return <WorkflowRunSteps logs={detail.logs} />;
  }

  return null;
};
