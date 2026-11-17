"use client";

import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TWorkflowResponseCompletedTriggerNode } from "@formbricks/workflows";
import { formatDateTimeForDisplay } from "@/lib/utils/datetime";
import { useWorkflowTestResponses } from "@/modules/ee/workflows/hooks/use-workflow-test-responses";
import { getWorkflowApiErrorMessage } from "@/modules/ee/workflows/lib/api-error";
import {
  type TTestResponseMismatch,
  type TWorkflowTestResponse,
  getTestResponseMismatch,
  resolveSelectedTestResponseId,
} from "@/modules/ee/workflows/lib/test-run-responses";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import { RadioGroup, RadioGroupItem } from "@/modules/ui/components/radio-group";
import { Skeleton } from "@/modules/ui/components/skeleton";

const CREATED_AT_DISPLAY_OPTIONS: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};

interface TestRunResponsePickerProps {
  responses: TWorkflowTestResponse[];
  selectedId: string | null;
  onSelect: (responseId: string) => void;
  mismatch: TTestResponseMismatch | null;
  locale: string;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
}

/**
 * The Test run drawer's Response completed trigger (ADR 0049): the bound survey's responses, newest
 * first, to run the draft against, in place of the Webhook trigger's test payload. Picking one the
 * trigger would skip is allowed; the drawer says why a real run would not fire on it.
 */
export const TestRunResponsePicker = ({
  responses,
  selectedId,
  onSelect,
  mismatch,
  locale,
  isLoading,
  error,
  onRetry,
  hasMore,
  isLoadingMore,
  onLoadMore,
}: Readonly<TestRunResponsePickerProps>) => {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="space-y-2" aria-busy="true">
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
    );
  }
  if (error) {
    return (
      <Alert variant="error">
        <AlertDescription className="flex items-center justify-between gap-3">
          {getWorkflowApiErrorMessage(error, t("workspace.workflows.test_response_load_failed"))}
          <Button type="button" variant="secondary" size="sm" onClick={onRetry}>
            {t("common.retry")}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
  if (responses.length === 0) {
    return <p className="text-sm text-slate-600">{t("workspace.workflows.test_response_empty")}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <RadioGroup
        value={selectedId ?? ""}
        onValueChange={onSelect}
        aria-label={t("workspace.workflows.test_response")}
        className="ph-no-capture max-h-72 gap-y-1 overflow-y-auto rounded-lg border border-slate-200 p-1">
        {responses.map((response) => (
          <label
            key={response.id}
            htmlFor={`test-response-${response.id}`}
            className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 hover:bg-slate-50 has-[[data-state=checked]]:bg-slate-100">
            <RadioGroupItem id={`test-response-${response.id}`} value={response.id} className="mt-0.5" />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex items-center gap-2 text-xs text-slate-500">
                {formatDateTimeForDisplay(new Date(response.createdAt), locale, CREATED_AT_DISPLAY_OPTIONS)}
                <Badge
                  size="tiny"
                  type={response.finished ? "success" : "gray"}
                  text={
                    response.finished
                      ? t("workspace.workflows.test_response_completed")
                      : t("workspace.workflows.test_response_partial")
                  }
                />
              </span>
              <span className="truncate text-sm text-slate-800">
                {response.firstAnswer ?? (
                  <span className="text-slate-500">{t("workspace.workflows.test_response_no_answer")}</span>
                )}
              </span>
            </span>
          </label>
        ))}
      </RadioGroup>
      {hasMore ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-fit"
          loading={isLoadingMore}
          onClick={onLoadMore}>
          {t("common.load_more")}
        </Button>
      ) : null}
      {mismatch === "partial" ? (
        <p className="text-xs text-amber-700">{t("workspace.workflows.test_response_mismatch_partial")}</p>
      ) : null}
      {mismatch === "other_ending" ? (
        <p className="text-xs text-amber-700">
          {t("workspace.workflows.test_response_mismatch_other_ending")}
        </p>
      ) : null}
    </div>
  );
};

/**
 * The picker for a Response completed workflow's Test run, with its selection: the newest completed
 * response unless another is picked. No picker, and no selection, for any other trigger.
 */
export const useTestRunResponsePicker = ({
  open,
  workflowId,
  trigger,
  locale,
}: {
  open: boolean;
  workflowId: string | null;
  trigger: TWorkflowResponseCompletedTriggerNode | null;
  locale: string;
}): { picker: ReactNode; selectedResponseId: string | null } => {
  const testResponses = useWorkflowTestResponses({
    workflowId: workflowId ?? "",
    surveyId: trigger?.config.surveyId ?? null,
    enabled: open && trigger !== null && workflowId !== null,
  });
  const [pickedResponseId, setPickedResponseId] = useState<string | null>(null);
  if (!trigger) return { picker: null, selectedResponseId: null };

  const selectedResponseId = resolveSelectedTestResponseId(testResponses.responses, pickedResponseId);
  const selectedResponse = testResponses.responses.find((response) => response.id === selectedResponseId);
  const mismatch = selectedResponse
    ? getTestResponseMismatch(selectedResponse, trigger.config.endingCardIds)
    : null;

  return {
    selectedResponseId,
    picker: (
      <TestRunResponsePicker
        responses={testResponses.responses}
        selectedId={selectedResponseId}
        onSelect={setPickedResponseId}
        mismatch={mismatch}
        locale={locale}
        isLoading={testResponses.isLoading}
        error={testResponses.error}
        onRetry={() => void testResponses.refetch()}
        hasMore={testResponses.hasNextPage}
        isLoadingMore={testResponses.isFetchingNextPage}
        onLoadMore={() => void testResponses.fetchNextPage()}
      />
    ),
  };
};
