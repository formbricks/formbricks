"use client";

import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { getWorkflowTriggerTypeLabel } from "@/modules/ee/workflows/lib/display";
import { describeWorkflowCondition } from "@/modules/ee/workflows/lib/if-else-summary";
import type {
  TRunDetailBadge,
  TRunDetailHttpRequestRow,
  TRunDetailIfElseRow,
  TRunDetailRow,
  TRunDetailSendEmailRow,
  TRunDetailStepRow,
} from "@/modules/ee/workflows/lib/run-detail-rows";
import { Badge } from "@/modules/ui/components/badge";
import { CodeBlock } from "@/modules/ui/components/code-block";
import { RunJsonCode } from "./run-json-code";

type TBadgeType = "warning" | "success" | "error" | "gray";

const getBadge = (badge: TRunDetailBadge, t: TFunction): { label: string; type: TBadgeType } => {
  switch (badge) {
    case "succeeded":
      return { label: t("common.succeeded"), type: "success" };
    case "failed":
      return { label: t("common.failed"), type: "error" };
    case "running":
      return { label: t("common.running"), type: "warning" };
    case "skipped":
      return { label: t("common.skipped"), type: "gray" };
    case "pending":
      return { label: t("common.pending"), type: "gray" };
    case "not_taken":
      return { label: t("workspace.workflows.run_step_not_taken"), type: "gray" };
    case "would_send":
      return { label: t("workspace.workflows.run_step_would_send"), type: "gray" };
    case "sending":
      return { label: t("workspace.workflows.run_step_sending"), type: "warning" };
    case "sent":
      return { label: t("workspace.workflows.run_step_sent"), type: "success" };
    case "delivery_failed":
      return { label: t("common.failed"), type: "error" };
  }
  const exhaustiveCheck: never = badge;
  return exhaustiveCheck;
};

const getStepTypeLabel = (stepType: string, t: TFunction): string => {
  switch (stepType) {
    case "if_else":
      return t("workspace.workflows.if_else");
    case "send_email":
      return t("workspace.workflows.send_email");
    case "http_request":
      return t("workspace.workflows.http_request");
    default:
      return stepType;
  }
};

const getBranchLabel = (branch: "then" | "else", t: TFunction): string =>
  branch === "then" ? t("workspace.workflows.branch_then") : t("workspace.workflows.branch_else");

const RowFrame = ({
  position,
  title,
  duration,
  badge,
  isMuted = false,
  children,
}: {
  readonly position: number;
  readonly title: string;
  readonly duration: string | null;
  readonly badge: { label: string; type: TBadgeType };
  readonly isMuted?: boolean;
  readonly children?: React.ReactNode;
}) => (
  <li className={cn("rounded-lg border border-slate-200 bg-white p-4", isMuted && "bg-slate-50")}>
    <div className="flex items-center gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
        {position}
      </span>
      <span
        className={cn("min-w-0 truncate text-sm font-medium", isMuted ? "text-slate-500" : "text-slate-800")}>
        {title}
      </span>
      <span className="shrink-0 text-xs text-slate-500">{duration ?? "—"}</span>
      <span className="ml-auto shrink-0">
        <Badge text={badge.label} type={badge.type} size="tiny" />
      </span>
    </div>
    {children ? <div className="mt-3 flex flex-col gap-2">{children}</div> : null}
  </li>
);

const FieldLine = ({ label, value }: { readonly label: string; readonly value: React.ReactNode }) => (
  <div className="grid grid-cols-[7rem_1fr] gap-2 text-xs">
    <dt className="text-slate-500">{label}</dt>
    <dd className="min-w-0 break-all text-slate-800">{value}</dd>
  </div>
);

const IfElseBody = ({ row }: { readonly row: TRunDetailIfElseRow }) => {
  const { t } = useTranslation();
  if (row.conditions.length === 0 && !row.branch) return null;
  // "(matched)" / "(not matched)" in words, no icons (mock screen 7).
  const parts = row.conditions.map(({ id, matched, condition }, index) => {
    const text =
      (condition ? describeWorkflowCondition(condition, t) : null) ??
      t("workspace.workflows.run_condition_unknown", { number: index + 1 });
    return {
      id,
      text: matched
        ? t("workspace.workflows.run_condition_matched", { condition: text })
        : t("workspace.workflows.run_condition_not_matched", { condition: text }),
    };
  });
  return (
    <p className="text-xs text-slate-600">
      {parts.map((part, index) => (
        <span key={part.id}>
          {index > 0 ? " · " : null}
          {part.text}
        </span>
      ))}
      {row.branch ? (
        <>
          {" → "}
          <b>{getBranchLabel(row.branch, t)}</b>
        </>
      ) : null}
    </p>
  );
};

const SendEmailBody = ({ row }: { readonly row: TRunDetailSendEmailRow }) => {
  const { t } = useTranslation();
  if (!row.recipient && !row.subject && !row.surveyLink) return null;
  return (
    <dl className="flex flex-col gap-1">
      {row.recipient ? (
        <FieldLine label={t("workspace.workflows.run_email_recipient")} value={row.recipient} />
      ) : null}
      {row.subject ? (
        <FieldLine label={t("workspace.workflows.run_email_subject")} value={row.subject} />
      ) : null}
      {row.surveyLink ? (
        <FieldLine
          label={t("workspace.workflows.run_email_survey_link")}
          value={
            <a href={row.surveyLink} target="_blank" rel="noreferrer noopener" className="underline">
              {row.surveyLink}
            </a>
          }
        />
      ) : null}
    </dl>
  );
};

const HttpRequestBody = ({ row }: { readonly row: TRunDetailHttpRequestRow }) => {
  const { t } = useTranslation();
  return (
    <>
      {row.requestText ? (
        <>
          <p className="text-xs font-medium text-slate-700">{t("workspace.workflows.run_http_request")}</p>
          <CodeBlock language="text" noMargin>
            {row.requestText}
          </CodeBlock>
          {row.requestBodyTruncated ? (
            <p className="text-xs text-slate-500">{t("workspace.workflows.run_http_body_truncated")}</p>
          ) : null}
        </>
      ) : null}
      {row.response ? (
        <>
          <p className="text-xs font-medium text-slate-700">
            {t("workspace.workflows.run_http_response", { status: row.response.status })}
          </p>
          {row.response.bodyText ? (
            <CodeBlock language="json" noMargin>
              {row.response.bodyText}
            </CodeBlock>
          ) : null}
          {row.response.bodyTruncated ? (
            <p className="text-xs text-slate-500">{t("workspace.workflows.run_http_body_truncated")}</p>
          ) : null}
        </>
      ) : null}
      {row.testSample === "used" ? (
        <p className="text-xs text-slate-500">{t("workspace.workflows.run_http_test_sample_used")}</p>
      ) : null}
      {row.testSample === "missing" ? (
        <p className="text-xs text-amber-700">{t("workspace.workflows.run_http_test_sample_missing")}</p>
      ) : null}
      {row.httpError ? <p className="text-xs text-slate-600">{row.httpError}</p> : null}
    </>
  );
};

const StepRow = ({ row }: { readonly row: TRunDetailStepRow }) => {
  const { t } = useTranslation();
  const title = row.label ?? getStepTypeLabel(row.stepType, t);
  const badge = getBadge(row.badge, t);

  if (row.kind === "not_taken") {
    return (
      <RowFrame position={row.position} title={title} duration={null} badge={badge} isMuted>
        {row.branch ? (
          <p className="text-xs text-slate-500">
            {row.branch === "then"
              ? t("workspace.workflows.run_step_on_then_branch")
              : t("workspace.workflows.run_step_on_else_branch")}
          </p>
        ) : null}
      </RowFrame>
    );
  }

  return (
    <RowFrame position={row.position} title={title} duration={row.duration} badge={badge}>
      {row.error ? <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{row.error}</p> : null}
      {row.kind === "if_else" ? <IfElseBody row={row} /> : null}
      {row.kind === "send_email" ? <SendEmailBody row={row} /> : null}
      {row.kind === "http_request" ? <HttpRequestBody row={row} /> : null}
    </RowFrame>
  );
};

interface RunDetailStepsProps {
  rows: TRunDetailRow[];
  /** Shown on the trigger row of a response-completed run, which has no payload. */
  responseId: string | null;
}

/** Run detail's numbered list (mock screens 7–9): the trigger, then each step. */
export const RunDetailSteps = ({ rows, responseId }: Readonly<RunDetailStepsProps>) => {
  const { t } = useTranslation();
  return (
    <ol className="flex flex-col gap-3">
      {rows.map((row) =>
        row.kind === "trigger" ? (
          <RowFrame
            key="trigger"
            position={1}
            title={getWorkflowTriggerTypeLabel(row.triggerType, t)}
            duration={null}
            badge={getBadge("succeeded", t)}>
            {row.payload ? <RunJsonCode value={row.payload} /> : null}
            {!row.payload && responseId ? (
              <p className="text-xs text-slate-600">
                {t("workspace.workflows.run_trigger_response", { responseId })}
              </p>
            ) : null}
          </RowFrame>
        ) : (
          <StepRow key={row.stepId} row={row} />
        )
      )}
    </ol>
  );
};
