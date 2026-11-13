"use client";

import { useAtomValue } from "jotai";
import {
  ClipboardPasteIcon,
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  InfoIcon,
  RefreshCwIcon,
  RotateCcwIcon,
} from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import {
  type TWebhookPayloadRefusal,
  type TWorkflowWebhookTriggerNode,
  WEBHOOK_CALLS_PER_MINUTE_PER_WORKFLOW,
  WEBHOOK_PAYLOAD_MAX_BYTES,
} from "@formbricks/workflows";
import { cn } from "@/lib/cn";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { WorkflowFieldError } from "@/modules/ee/workflows/components/inspector/workflow-field";
import { JsonEditor } from "@/modules/ee/workflows/components/json-editor/json-editor";
import {
  useWorkflowWebhook,
  useWorkflowWebhookMutations,
} from "@/modules/ee/workflows/hooks/use-workflow-webhook";
import { formatCallerIp } from "@/modules/ee/workflows/lib/caller-ip";
import { formatRelativeDate } from "@/modules/ee/workflows/lib/format-date";
import {
  type TVariableTypeLabel,
  clearStoredTestPayload,
  formatPayload,
  isSampleFromLastCall,
  maskWebhookSecretUrl,
  parsePastedSample,
  readStoredTestPayload,
  resolveTestPayload,
  toVariableListRows,
  writeStoredTestPayload,
} from "@/modules/ee/workflows/lib/webhook-trigger-panel";
import { hasSavedWebhookTrigger } from "@/modules/ee/workflows/lib/workflow-samples";
import { isWorkflowReadOnlyAtom, workflowAtom } from "@/modules/ee/workflows/state/editor";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { CodeBlock } from "@/modules/ui/components/code-block";
import { ConfirmationModal } from "@/modules/ui/components/confirmation-modal";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { Skeleton } from "@/modules/ui/components/skeleton";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";

interface WorkflowWebhookTriggerFormProps {
  node: TWorkflowWebhookTriggerNode;
  isEditable: boolean;
  onChange: (next: TWorkflowWebhookTriggerNode) => void;
}

const SECRET_URL_FIELD_ID = "workflow-webhook-secret-url";

const useTypeLabel = () => {
  const { t } = useTranslation();
  return (label: TVariableTypeLabel): string => {
    switch (label) {
      case "text":
        return t("workspace.workflows.variable_type_text");
      case "number":
        return t("workspace.workflows.variable_type_number");
      case "true_false":
        return t("workspace.workflows.variable_type_boolean");
      case "object":
        return t("workspace.workflows.variable_type_object");
      case "empty":
        return t("workspace.workflows.variable_type_empty");
      case "list":
        return t("workspace.workflows.variable_type_list");
      case "unsupported":
        return t("workspace.workflows.variable_not_supported");
    }
  };
};

const usePasteErrorMessage = () => {
  const { t } = useTranslation();
  return (reason: TWebhookPayloadRefusal): string => {
    switch (reason) {
      case "invalid_json":
        return t("workspace.workflows.webhook_paste_invalid_json");
      case "not_object":
        return t("workspace.workflows.webhook_paste_not_object");
      case "too_deep":
        return t("workspace.workflows.webhook_paste_too_deep");
      case "too_large":
        return t("workspace.workflows.webhook_paste_too_large", {
          size: WEBHOOK_PAYLOAD_MAX_BYTES / 1024,
        });
      case "null_byte":
        return t("workspace.workflows.webhook_paste_null_byte");
    }
  };
};

/**
 * The Webhook trigger panel (ED3, ED6, mock screens 2 and 6): the Webhook Secret URL (masked, eye,
 * Copy, Regenerate), its last call and limits, the Sample payload (or how to get one) with the
 * Variables it offers, and the editable test payload a Test run uses. The Secret URL is a credential
 * (ADR 0041): only people who can edit the workflow see it, and it is kept out of session recordings.
 */
export const WorkflowWebhookTriggerForm = (_props: Readonly<WorkflowWebhookTriggerFormProps>) => {
  const { t } = useTranslation();
  const workflow = useAtomValue(workflowAtom);
  const isReadOnly = useAtomValue(isWorkflowReadOnlyAtom);
  const workflowId = workflow?.id ?? null;
  const isSaved = hasSavedWebhookTrigger(workflow);
  const webhookQuery = useWorkflowWebhook({ workflowId, enabled: isSaved && !isReadOnly });

  if (isReadOnly) {
    return (
      <Alert variant="info">
        <AlertDescription>{t("workspace.workflows.webhook_url_write_access_only")}</AlertDescription>
      </Alert>
    );
  }

  if (!workflowId || !isSaved || webhookQuery.isPending) {
    // The URL is issued when the new trigger's save lands, a moment after it is added.
    return (
      <div className="flex flex-col gap-2" aria-busy="true">
        <Skeleton className="h-4 w-40 rounded-md" />
        <Skeleton className="h-9 w-full rounded-md" />
        <p className="text-xs text-slate-500">{t("workspace.workflows.webhook_url_preparing")}</p>
      </div>
    );
  }

  if (webhookQuery.isError || !webhookQuery.data) {
    return (
      <Alert variant="error">
        <AlertDescription>
          {getV3ApiErrorMessage(webhookQuery.error, t("workspace.workflows.webhook_load_failed"))}
        </AlertDescription>
      </Alert>
    );
  }

  const webhook = webhookQuery.data;

  return (
    <div className="flex flex-col gap-5">
      <WebhookSecretUrlSection
        workflowId={workflowId}
        url={webhook.url}
        lastCalledAt={webhook.lastCalledAt}
        lastCallerIp={webhook.lastCallerIp}
        canRegenerate={workflow?.status !== "archived"}
      />
      <WebhookSampleSection
        workflowId={workflowId}
        sample={webhook.sample}
        lastCalledAt={webhook.lastCalledAt}
        lastCallerIp={webhook.lastCallerIp}
        canSetSample={workflow?.status !== "archived"}
      />
      <WebhookTestPayloadSection workflowId={workflowId} sample={webhook.sample?.payload ?? null} />
    </div>
  );
};

const useRelativeTime = () => {
  const { t, i18n } = useTranslation();
  return (iso: string) =>
    formatRelativeDate(
      iso,
      new Date(),
      t,
      i18n.language || "en-US",
      Intl.DateTimeFormat().resolvedOptions().timeZone
    );
};

const useCallerIpLabel = () => {
  const { t } = useTranslation();
  return (ip: string | null): string => {
    const display = formatCallerIp(ip);
    return display.kind === "unknown" ? t("workspace.workflows.run_caller_unknown") : display.text;
  };
};

const WebhookSecretUrlSection = ({
  workflowId,
  url,
  lastCalledAt,
  lastCallerIp,
  canRegenerate,
}: {
  readonly workflowId: string;
  readonly url: string;
  readonly lastCalledAt: string | null;
  readonly lastCallerIp: string | null;
  readonly canRegenerate: boolean;
}) => {
  const { t } = useTranslation();
  const relativeTime = useRelativeTime();
  const callerIpLabel = useCallerIpLabel();
  const { regenerate } = useWorkflowWebhookMutations(workflowId);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("workspace.workflows.webhook_url_copied"));
    } catch {
      toast.error(t("workspace.workflows.webhook_url_copy_failed"));
    }
  };

  const limits = t("workspace.workflows.webhook_limits", {
    calls: WEBHOOK_CALLS_PER_MINUTE_PER_WORKFLOW,
    size: WEBHOOK_PAYLOAD_MAX_BYTES / 1024,
  });

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={SECRET_URL_FIELD_ID}>{t("workspace.workflows.webhook_secret_url")}</Label>
        <TooltipRenderer
          className="max-w-72"
          tooltipContent={t("workspace.workflows.webhook_secret_url_tooltip")}>
          <InfoIcon
            className="size-3.5 text-slate-500"
            aria-label={t("workspace.workflows.webhook_secret_url_tooltip")}
          />
        </TooltipRenderer>
      </div>
      {/* ph-no-capture keeps the field (and the URL in it) out of PostHog session recordings. */}
      <div className="ph-no-capture flex items-center gap-2">
        <Input
          id={SECRET_URL_FIELD_ID}
          readOnly
          value={isRevealed ? url : maskWebhookSecretUrl(url)}
          className="ph-no-capture min-w-0 flex-1 bg-slate-50 font-mono text-xs"
          onFocus={(event) => event.currentTarget.select()}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-pressed={isRevealed}
          aria-label={
            isRevealed ? t("workspace.workflows.webhook_url_hide") : t("workspace.workflows.webhook_url_show")
          }
          onClick={() => setIsRevealed((current) => !current)}>
          {isRevealed ? <EyeOffIcon /> : <EyeIcon />}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={() => void copy()}>
          <CopyIcon />
          {t("common.copy")}
        </Button>
      </div>
      <p className="text-xs text-slate-500">{t("workspace.workflows.webhook_secret_url_help")}</p>
      {/* Wraps instead of overflowing the 360px inspector: the line may hold a long IPv6 network. */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="min-w-0 flex-1 basis-40 text-xs break-words text-slate-500">
          {lastCalledAt
            ? t("workspace.workflows.webhook_last_call", {
                time: relativeTime(lastCalledAt),
                ip: callerIpLabel(lastCallerIp),
                limits,
              })
            : t("workspace.workflows.webhook_never_called", { limits })}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          disabled={!canRegenerate || regenerate.isPending}
          loading={regenerate.isPending}
          onClick={() => setIsConfirmOpen(true)}>
          <RefreshCwIcon />
          {t("workspace.workflows.webhook_regenerate")}
        </Button>
      </div>
      <ConfirmationModal
        open={isConfirmOpen}
        setOpen={setIsConfirmOpen}
        title={t("workspace.workflows.webhook_regenerate_title")}
        body={t("workspace.workflows.webhook_regenerate_body")}
        buttonText={t("workspace.workflows.webhook_regenerate")}
        buttonVariant="destructive"
        buttonLoading={regenerate.isPending}
        onConfirm={() =>
          regenerate.mutate(undefined, {
            onSuccess: () => {
              setIsConfirmOpen(false);
              setIsRevealed(false);
              toast.success(t("workspace.workflows.webhook_regenerated"));
            },
            onError: (error) =>
              toast.error(getV3ApiErrorMessage(error, t("workspace.workflows.webhook_regenerate_failed"))),
          })
        }
        Icon={RefreshCwIcon}
      />
    </section>
  );
};

const WebhookSampleSection = ({
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

const WebhookTestPayloadSection = ({
  workflowId,
  sample,
}: {
  readonly workflowId: string;
  readonly sample: Record<string, unknown> | null;
}) => {
  const { t } = useTranslation();
  // Read once when the panel opens (it only renders in the browser, after the workflow loaded); kept
  // in this browser per workflow (ED6). Storage may be unavailable, in which case edits last only
  // while the panel is open.
  const [stored, setStored] = useState<string | null>(() => readStoredTestPayload(workflowId));

  const { text, source } = resolveTestPayload({ stored, sample });

  const statusTexts: Record<typeof source, string> = {
    edited: t("workspace.workflows.test_payload_edited"),
    received: t("workspace.workflows.test_payload_from_sample"),
    empty: t("workspace.workflows.test_payload_empty"),
  };
  const statusText = statusTexts[source];

  return (
    <section className="flex flex-col gap-2">
      <Label htmlFor="workflow-webhook-test-payload">{t("workspace.workflows.test_payload")}</Label>
      <div className="ph-no-capture">
        <JsonEditor
          id="workflow-webhook-test-payload"
          label={t("workspace.workflows.test_payload")}
          value={text}
          // Blank until there is a sample or an edit; only a started payload must be valid JSON.
          allowEmpty
          onChange={(next) => {
            setStored(next);
            writeStoredTestPayload(workflowId, next);
          }}
        />
      </div>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-slate-500">{statusText}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={source !== "edited" || !sample}
          onClick={() => {
            clearStoredTestPayload(workflowId);
            setStored(null);
          }}>
          <RotateCcwIcon />
          {t("workspace.workflows.test_payload_reset")}
        </Button>
      </div>
      <Alert variant="info">
        <AlertDescription>{t("workspace.workflows.test_payload_hint")}</AlertDescription>
      </Alert>
    </section>
  );
};
