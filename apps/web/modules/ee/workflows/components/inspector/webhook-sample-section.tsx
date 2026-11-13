"use client";

import { ClipboardPasteIcon } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import {
  useCallerIpLabel,
  usePasteErrorMessage,
  useRelativeTime,
  useTypeLabel,
} from "@/modules/ee/workflows/components/inspector/webhook-trigger-labels";
import { WorkflowFieldError } from "@/modules/ee/workflows/components/inspector/workflow-field";
import { JsonEditor } from "@/modules/ee/workflows/components/json-editor/json-editor";
import { useWorkflowWebhookMutations } from "@/modules/ee/workflows/hooks/use-workflow-webhook";
import {
  formatPayload,
  isSampleFromLastCall,
  parsePastedSample,
  toVariableListRows,
} from "@/modules/ee/workflows/lib/webhook-trigger-panel";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { CodeBlock } from "@/modules/ui/components/code-block";
import { Label } from "@/modules/ui/components/label";

export const WebhookSampleSection = ({
  workflowId,
  sample,
  lastCalledAt,
  lastCallerIp,
  canSetSample,
}: {
  readonly workflowId: string;
  readonly sample: {
    payload: Record<string, unknown>;
    updatedAt: string;
    variables: Parameters<typeof toVariableListRows>[0];
  } | null;
  readonly lastCalledAt: string | null;
  readonly lastCallerIp: string | null;
  readonly canSetSample: boolean;
}) => {
  const { t } = useTranslation();
  const relativeTime = useRelativeTime();
  const callerIpLabel = useCallerIpLabel();
  const typeLabel = useTypeLabel();
  const pasteErrorMessage = usePasteErrorMessage();
  const { setSample } = useWorkflowWebhookMutations(workflowId);
  const [pastedText, setPastedText] = useState<string | null>(null);
  const pasted = pastedText === null ? null : parsePastedSample(pastedText);

  const savePasted = () => {
    if (!pasted?.ok) return;
    setSample.mutate(pasted.payload, {
      onSuccess: () => {
        setPastedText(null);
        toast.success(t("workspace.workflows.webhook_sample_saved"));
      },
      onError: (error) =>
        toast.error(getV3ApiErrorMessage(error, t("workspace.workflows.webhook_sample_save_failed"))),
    });
  };

  const isFromLastCall = sample !== null && isSampleFromLastCall(sample.updatedAt, lastCalledAt);

  const pasteEditor =
    pastedText === null ? null : (
      <div className="flex flex-col gap-2">
        <JsonEditor
          id="workflow-webhook-paste-sample"
          label={t("workspace.workflows.webhook_sample_payload")}
          value={pastedText}
          onChange={setPastedText}
          // "Use as sample" stays disabled until it parses; no error before anything is pasted.
          allowEmpty
          placeholder='{ "customer": { "email": "jane@example.com" } }'
        />
        {pasted && !pasted.ok && pastedText.trim() !== "" && pasted.reason !== "invalid_json" ? (
          <WorkflowFieldError id="workflow-webhook-paste-error">
            {pasteErrorMessage(pasted.reason)}
          </WorkflowFieldError>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setPastedText(null)}>
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!pasted?.ok || setSample.isPending}
            loading={setSample.isPending}
            onClick={savePasted}>
            {t("workspace.workflows.webhook_sample_use")}
          </Button>
        </div>
      </div>
    );

  if (!sample) {
    return (
      <section className="flex flex-col gap-2">
        <Label>{t("workspace.workflows.webhook_sample_payload")}</Label>
        {pasteEditor ?? (
          <div className="flex flex-col items-start gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50 p-3">
            <p className="text-sm text-slate-600">{t("workspace.workflows.webhook_sample_empty")}</p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!canSetSample}
              onClick={() => setPastedText("")}>
              <ClipboardPasteIcon />
              {t("workspace.workflows.webhook_sample_paste")}
            </Button>
          </div>
        )}
      </section>
    );
  }

  const rows = toVariableListRows(sample.variables);

  return (
    <>
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <Label>{t("workspace.workflows.webhook_sample_payload")}</Label>
          {pastedText === null && canSetSample ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setPastedText(formatPayload(sample.payload))}>
              <ClipboardPasteIcon />
              {t("workspace.workflows.webhook_sample_paste")}
            </Button>
          ) : null}
        </div>
        {pasteEditor ?? (
          <>
            <Alert variant="success">
              <AlertDescription>
                {isFromLastCall
                  ? t("workspace.workflows.webhook_sample_received", {
                      time: relativeTime(sample.updatedAt),
                      ip: callerIpLabel(lastCallerIp),
                    })
                  : t("workspace.workflows.webhook_sample_pasted", { time: relativeTime(sample.updatedAt) })}
              </AlertDescription>
            </Alert>
            <div className="ph-no-capture max-h-64 overflow-auto">
              <CodeBlock language="json" noMargin showCopyToClipboard>
                {formatPayload(sample.payload)}
              </CodeBlock>
            </div>
          </>
        )}
      </section>
      <section className="flex flex-col gap-2">
        <Label>{t("workspace.workflows.webhook_sample_variables")}</Label>
        {rows.length === 0 ? (
          <p className="text-xs text-slate-500">{t("workspace.workflows.webhook_sample_no_variables")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-slate-100 rounded-md border border-slate-200">
            {rows.map((row) => (
              <li
                key={row.path}
                className={cn(
                  "flex items-center justify-between gap-2 px-3 py-1.5 text-xs",
                  row.isSupported ? "text-slate-800" : "text-slate-400"
                )}>
                <span className="truncate font-mono">{row.name}</span>
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-1.5 py-0.5",
                    row.isSupported ? "border-slate-200 text-slate-600" : "border-slate-100 text-slate-400"
                  )}>
                  {row.isSupported
                    ? typeLabel(row.typeLabel)
                    : `${typeLabel(row.typeLabel)} · ${t("workspace.workflows.variable_not_supported_yet")}`}
                </span>
              </li>
            ))}
          </ul>
        )}
        {sample.variables.truncated ? (
          <p className="text-xs text-slate-500">
            {t("workspace.workflows.variable_picker_truncated", { count: rows.length })}
          </p>
        ) : null}
        <p className="text-xs text-slate-500">{t("workspace.workflows.webhook_sample_variables_help")}</p>
      </section>
    </>
  );
};
