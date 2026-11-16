"use client";

import { useEffect, useRef, useState } from "react";
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
import { useStoredTestPayload } from "@/modules/ee/workflows/hooks/use-stored-test-payload";
import { useWorkflowWebhookMutations } from "@/modules/ee/workflows/hooks/use-workflow-webhook";
import {
  formatPayload,
  isSampleFromLastCall,
  parsePastedSample,
  toVariableListRows,
} from "@/modules/ee/workflows/lib/webhook-trigger-panel";
import { Label } from "@/modules/ui/components/label";

const SAVE_DELAY_MS = 800;

/**
 * One Payload for the Webhook trigger (prototype): the last received or pasted payload, editable in
 * place. Edits are saved as the workflow's payload, so the Variables and Test run always use what is
 * shown; the next call to the Secret URL replaces it.
 */
export const WebhookPayloadSection = ({
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
  // The Test run drawer reads this browser copy first; clearing it makes Test run use the saved payload.
  const [, setStoredTestPayload] = useStoredTestPayload(workflowId);
  const [draft, setDraft] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    []
  );

  const text = draft ?? (sample ? formatPayload(sample.payload) : "");
  const parsed = draft === null || draft.trim() === "" ? null : parsePastedSample(draft);

  const onChange = (next: string) => {
    setDraft(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const check = next.trim() === "" ? null : parsePastedSample(next);
    if (!check?.ok) return;
    saveTimer.current = setTimeout(() => {
      setSample.mutate(check.payload, {
        onSuccess: () => {
          setDraft(null);
          setStoredTestPayload(null);
        },
        onError: (error) =>
          toast.error(getV3ApiErrorMessage(error, t("workspace.workflows.webhook_payload_save_failed"))),
      });
    }, SAVE_DELAY_MS);
  };

  const statusLine = (() => {
    if (draft !== null && parsed?.ok) return t("workspace.workflows.webhook_payload_saving");
    if (!sample) return t("workspace.workflows.webhook_payload_empty");
    if (isSampleFromLastCall(sample.updatedAt, lastCalledAt)) {
      return t("workspace.workflows.webhook_payload_received", {
        time: relativeTime(sample.updatedAt),
        ip: callerIpLabel(lastCallerIp),
      });
    }
    return t("workspace.workflows.webhook_payload_edited", { time: relativeTime(sample.updatedAt) });
  })();

  const rows = sample ? toVariableListRows(sample.variables) : [];

  return (
    <>
      <section className="flex flex-col gap-2">
        <Label htmlFor="workflow-webhook-payload">{t("workspace.workflows.webhook_payload")}</Label>
        <div className="ph-no-capture">
          <JsonEditor
            id="workflow-webhook-payload"
            label={t("workspace.workflows.webhook_payload")}
            value={text}
            onChange={canSetSample ? onChange : undefined}
            allowEmpty
            placeholder='{ "customer": { "email": "jane@example.com" } }'
          />
        </div>
        {parsed && !parsed.ok && parsed.reason !== "invalid_json" ? (
          <WorkflowFieldError id="workflow-webhook-payload-error">
            {pasteErrorMessage(parsed.reason)}
          </WorkflowFieldError>
        ) : null}
        <p className="text-xs text-slate-500">{statusLine}</p>
      </section>

      {sample ? (
        <section className="flex flex-col gap-2">
          <Label>{t("workspace.workflows.webhook_payload_variables")}</Label>
          {rows.length === 0 ? (
            <p className="text-xs text-slate-500">{t("workspace.workflows.webhook_payload_no_variables")}</p>
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
          <p className="text-xs text-slate-500">{t("workspace.workflows.webhook_sample_variables_help")}</p>
        </section>
      ) : null}

      <p className="text-xs text-slate-500">{t("workspace.workflows.webhook_payload_test_hint")}</p>
    </>
  );
};
