"use client";

import { CopyIcon, InboxIcon, PencilIcon } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import type { TWorkflowWebhookResource } from "@formbricks/workflows";
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
import { useJsonSampleDraft } from "@/modules/ee/workflows/hooks/use-json-sample-draft";
import { useStoredTestPayload } from "@/modules/ee/workflows/hooks/use-stored-test-payload";
import { useWorkflowWebhookMutations } from "@/modules/ee/workflows/hooks/use-workflow-webhook";
import { formatCallerIp } from "@/modules/ee/workflows/lib/caller-ip";
import {
  formatPayload,
  maskWebhookSecretUrl,
  toVariableListRows,
} from "@/modules/ee/workflows/lib/webhook-trigger-panel";
import { Button } from "@/modules/ui/components/button";
import { CodeBlock } from "@/modules/ui/components/code-block";

const EXAMPLE_BODY = '{"customer":{"email":"jane@example.com"}}';

export type TPayloadView = "variables" | "json";
type TExpectedPayload = NonNullable<TWorkflowWebhookResource["sample"]>;
type TLastCall = NonNullable<TWorkflowWebhookResource["lastCall"]>;

const buildCurl = (url: string) =>
  `curl -X POST "${url}" \\\n  -H "Content-Type: application/json" \\\n  -d '${EXAMPLE_BODY}'`;

/** A newer call worth offering: it arrived after the expected payload was set and sends something else. */
const isNewerDifferentCall = (
  lastCall: TLastCall | null,
  sample: TExpectedPayload,
  dismissedCallAt: string | null
): lastCall is TLastCall =>
  lastCall !== null &&
  lastCall.receivedAt !== dismissedCallAt &&
  Date.parse(lastCall.receivedAt) > Date.parse(sample.updatedAt) &&
  JSON.stringify(lastCall.payload) !== JSON.stringify(sample.payload);

/** A compact two-option switch, styled like the app's TabToggle but sized for a card header. */
export const ViewSwitch = ({
  value,
  onChange,
}: Readonly<{
  value: TPayloadView;
  onChange: (next: TPayloadView) => void;
}>) => {
  const { t } = useTranslation();
  const name = useId();
  const options: { value: TPayloadView; label: string }[] = [
    { value: "variables", label: t("workspace.workflows.webhook_payload_view_variables") },
    { value: "json", label: t("workspace.workflows.webhook_payload_view_json") },
  ];
  return (
    <div
      role="radiogroup"
      aria-label={t("workspace.workflows.webhook_payload_view")}
      className="flex shrink-0 rounded-md bg-slate-100 p-0.5">
      {/* Native radios, as TabToggle has them: arrow keys move between the two views. */}
      {options.map((option) => (
        <label
          key={option.value}
          className={cn(
            "cursor-pointer rounded px-2 py-0.5 text-xs text-slate-600 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-dark/50",
            value === option.value && "bg-white font-medium text-slate-900 shadow-xs"
          )}>
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="sr-only"
          />
          {option.label}
        </label>
      ))}
    </div>
  );
};

/** The card header: what the expected payload is, then the view switch or the "Required" tag. */
const PayloadHeader = ({ aside }: Readonly<{ aside: ReactNode }>) => {
  const { t } = useTranslation();
  return (
    <header className="flex items-start justify-between gap-3 px-3 py-2.5">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-sm font-semibold text-slate-900">
          {t("workspace.workflows.webhook_expected_payload")}
        </h3>
        <p className="text-xs text-slate-500">{t("workspace.workflows.webhook_expected_payload_inferred")}</p>
      </div>
      {aside}
    </header>
  );
};

const RequiredTag = () => {
  const { t } = useTranslation();
  return (
    <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
      {t("workspace.workflows.webhook_expected_payload_required")}
    </span>
  );
};

/** A blue notice about a received call, with the actions it offers. */
export const CallNotice = ({ message, children }: Readonly<{ message: string; children: ReactNode }>) => (
  <div className="flex flex-col gap-2 border-t border-blue-100 bg-blue-50 px-3 py-2.5">
    <p className="flex items-start gap-1.5 text-xs text-blue-900">
      <InboxIcon className="mt-px size-3.5 shrink-0" aria-hidden />
      {message}
    </p>
    <div className="flex flex-wrap gap-2">{children}</div>
  </div>
);

/** The Variables inferred from a payload; lists are shown as not supported yet. */
export const VariableRows = ({ variables }: Readonly<{ variables: TExpectedPayload["variables"] }>) => {
  const { t } = useTranslation();
  const typeLabel = useTypeLabel();
  const rows = toVariableListRows(variables);
  if (rows.length === 0) {
    return (
      <p className="px-3 py-3 text-xs text-slate-500">
        {t("workspace.workflows.webhook_payload_no_variables")}
      </p>
    );
  }
  return (
    <>
      <ul className="flex flex-col divide-y divide-slate-100">
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
      {variables.truncated ? (
        <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
          {t("workspace.workflows.variable_picker_truncated", { count: rows.length })}
        </p>
      ) : null}
    </>
  );
};

/** What a received call sent: its Variables, or its JSON (read-only). */
const CallPayload = ({ call, view }: Readonly<{ call: TLastCall; view: TPayloadView }>) =>
  view === "json" ? (
    <div className="ph-no-capture max-h-64 overflow-auto p-3">
      <CodeBlock language="json" noMargin>
        {formatPayload(call.payload)}
      </CodeBlock>
    </div>
  ) : (
    <VariableRows variables={call.variables} />
  );

/** Before anything is set or received: write the payload, or send a test call (with a curl example). */
const WaitingForCall = ({
  url,
  canSetSample,
  onWrite,
}: Readonly<{
  url: string;
  canSetSample: boolean;
  onWrite: () => void;
}>) => {
  const { t } = useTranslation();
  const copyCurl = async () => {
    try {
      await navigator.clipboard.writeText(buildCurl(url));
      toast.success(t("workspace.workflows.webhook_curl_copied"));
    } catch {
      toast.error(t("workspace.workflows.webhook_url_copy_failed"));
    }
  };
  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 p-3">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="w-full"
        disabled={!canSetSample}
        onClick={onWrite}>
        <PencilIcon />
        {t("workspace.workflows.webhook_expected_payload_write")}
      </Button>
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        {t("common.or")}
        <span className="h-px flex-1 bg-slate-200" />
      </div>
      <div className="flex items-center gap-2">
        <span className="relative flex size-2" aria-hidden>
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
        </span>
        <p className="text-xs text-slate-600">{t("workspace.workflows.webhook_waiting_body")}</p>
      </div>
      {/* The example shows the masked URL; Copy puts the real one on the clipboard. */}
      <div className="ph-no-capture relative w-full rounded-md bg-slate-900 text-left">
        <pre className="py-2.5 pr-10 pl-3 font-mono text-[11px] leading-5 break-all whitespace-pre-wrap text-slate-100">
          {buildCurl(maskWebhookSecretUrl(url))}
        </pre>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute top-1 right-1 text-slate-300 hover:bg-slate-800 hover:text-white"
          aria-label={t("workspace.workflows.webhook_curl_copy")}
          onClick={() => void copyCurl()}>
          <CopyIcon />
        </Button>
      </div>
    </div>
  );
};

/** The expected payload's editor. A save clears the Test run drawer's browser copy, so Test run sends it. */
const usePayloadEditor = (workflowId: string) => {
  const { t } = useTranslation();
  const { setSample } = useWorkflowWebhookMutations(workflowId);
  const [, setStoredTestPayload] = useStoredTestPayload(workflowId);
  const editor = useJsonSampleDraft((payload, { onSuccess }) =>
    setSample.mutate(payload, {
      onSuccess: () => {
        setStoredTestPayload(null);
        onSuccess();
      },
      onError: (error) =>
        toast.error(getV3ApiErrorMessage(error, t("workspace.workflows.webhook_payload_save_failed"))),
    })
  );
  return { ...editor, isPending: setSample.isPending };
};

type TEditor = ReturnType<typeof usePayloadEditor>;

/** The JSON editor for the expected payload, with the reason a pasted payload can't be used. */
const PayloadJsonEditor = ({
  editor,
  sample,
  canSetSample,
}: Readonly<{
  editor: TEditor;
  sample: TExpectedPayload | null;
  canSetSample: boolean;
}>) => {
  const { t } = useTranslation();
  const pasteErrorMessage = usePasteErrorMessage();
  const reason = editor.parsed && !editor.parsed.ok ? editor.parsed.reason : null;
  return (
    <div className="ph-no-capture">
      <JsonEditor
        id="workflow-webhook-payload"
        label={t("workspace.workflows.webhook_expected_payload")}
        value={editor.draft ?? (sample ? formatPayload(sample.payload) : "")}
        onChange={canSetSample ? editor.edit : undefined}
        allowEmpty
        placeholder='{ "customer": { "email": "jane@example.com" } }'
      />
      <p className="mt-1.5 text-xs text-slate-500">{t("workspace.workflows.webhook_payload_json_hint")}</p>
      {reason && reason !== "invalid_json" ? (
        <WorkflowFieldError id="workflow-webhook-payload-error">
          {pasteErrorMessage(reason)}
        </WorkflowFieldError>
      ) : null}
    </div>
  );
};

/** No expected payload and nothing received yet: write one, or send a test call. */
const NoPayloadCard = ({
  url,
  canSetSample,
  onWrite,
}: Readonly<{
  url: string;
  canSetSample: boolean;
  onWrite: () => void;
}>) => (
  <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
    <PayloadHeader aside={<RequiredTag />} />
    <WaitingForCall url={url} canSetSample={canSetSample} onWrite={onWrite} />
  </section>
);

/** No expected payload, but a call arrived: show what it sent, and let the editor choose to use it. */
const ReceivedCallCard = ({
  lastCall,
  editor,
  canSetSample,
  onEditFirst,
}: Readonly<{
  lastCall: TLastCall;
  editor: TEditor;
  canSetSample: boolean;
  onEditFirst: () => void;
}>) => {
  const { t } = useTranslation();
  const relativeTime = useRelativeTime();
  const callerIpLabel = useCallerIpLabel();
  const [view, setView] = useState<TPayloadView>("variables");
  // An unknown caller (no IP, or one that can't be shown) is left out rather than written as "Unknown".
  const message =
    formatCallerIp(lastCall.callerIp).kind === "unknown"
      ? t("workspace.workflows.webhook_call_pending_no_ip", { time: relativeTime(lastCall.receivedAt) })
      : t("workspace.workflows.webhook_call_pending", {
          time: relativeTime(lastCall.receivedAt),
          ip: callerIpLabel(lastCall.callerIp),
        });
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <PayloadHeader aside={<ViewSwitch value={view} onChange={setView} />} />
      <CallNotice message={message}>
        <Button
          type="button"
          size="sm"
          disabled={!canSetSample || editor.isPending}
          loading={editor.isPending}
          onClick={() => editor.save(lastCall.payload)}>
          {t("workspace.workflows.webhook_call_use")}
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={!canSetSample} onClick={onEditFirst}>
          <PencilIcon />
          {t("workspace.workflows.webhook_call_edit_first")}
        </Button>
      </CallNotice>
      <div className="border-t border-slate-100">
        <CallPayload call={lastCall} view={view} />
      </div>
    </section>
  );
};

/** The actions for a newer call with different fields: review it, then use it or keep the current one. */
const NewerCallNotice = ({
  call,
  editor,
  canSetSample,
  isReviewing,
  onReview,
  onDone,
}: Readonly<{
  call: TLastCall;
  editor: TEditor;
  canSetSample: boolean;
  isReviewing: boolean;
  onReview: () => void;
  onDone: (dismissed: boolean) => void;
}>) => {
  const { t } = useTranslation();
  const relativeTime = useRelativeTime();
  return (
    <CallNotice
      message={t("workspace.workflows.webhook_call_newer", { time: relativeTime(call.receivedAt) })}>
      {isReviewing ? (
        <>
          <Button
            type="button"
            size="sm"
            disabled={!canSetSample || editor.isPending}
            loading={editor.isPending}
            onClick={() => editor.save(call.payload, () => onDone(false))}>
            {t("workspace.workflows.webhook_call_use_instead")}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => onDone(true)}>
            {t("workspace.workflows.webhook_call_keep")}
          </Button>
        </>
      ) : (
        <Button type="button" variant="secondary" size="sm" onClick={onReview}>
          {t("workspace.workflows.webhook_call_review")}
        </Button>
      )}
    </CallNotice>
  );
};

/**
 * The expected payload being written, or set. One card for both, so the JSON editor stays mounted, with
 * its focus and cursor, when the first save sets the payload. A newer call with different fields is
 * offered, never applied on its own.
 */
const ExpectedPayloadCard = ({
  sample,
  lastCall,
  editor,
  canSetSample,
}: Readonly<{
  sample: TExpectedPayload | null;
  lastCall: TLastCall | null;
  editor: TEditor;
  canSetSample: boolean;
}>) => {
  const { t } = useTranslation();
  const relativeTime = useRelativeTime();
  // Opened to write the first payload: the JSON view, so the editor is still there once it saves.
  const [view, setView] = useState<TPayloadView>(sample ? "variables" : "json");
  const [isReviewing, setIsReviewing] = useState(false);
  const [dismissedCallAt, setDismissedCallAt] = useState<string | null>(null);
  const newerCall = sample && isNewerDifferentCall(lastCall, sample, dismissedCallAt) ? lastCall : null;
  const reviewedCall = isReviewing ? newerCall : null;

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <PayloadHeader aside={sample ? <ViewSwitch value={view} onChange={setView} /> : <RequiredTag />} />
      {newerCall ? (
        <NewerCallNotice
          call={newerCall}
          editor={editor}
          canSetSample={canSetSample}
          isReviewing={isReviewing}
          onReview={() => setIsReviewing(true)}
          onDone={(dismissed) => {
            setIsReviewing(false);
            if (dismissed) setDismissedCallAt(newerCall.receivedAt);
          }}
        />
      ) : null}
      <div className="border-t border-slate-100">
        {!sample || (view === "json" && !reviewedCall) ? (
          <div className="p-3">
            <PayloadJsonEditor editor={editor} sample={sample} canSetSample={canSetSample} />
          </div>
        ) : (
          <ExpectedPayloadBody sample={sample} view={view} reviewedCall={reviewedCall} />
        )}
      </div>
      {sample ? (
        <footer className="border-t border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          {editor.hasUnsavedEdit
            ? t("workspace.workflows.webhook_payload_saving")
            : t("workspace.workflows.webhook_expected_payload_owned", {
                time: relativeTime(sample.updatedAt),
              })}
        </footer>
      ) : null}
    </section>
  );
};

/**
 * The Webhook trigger's expected payload (ADR 0052): what the calling system sends to the Secret URL.
 * Editors own it: they write or paste it, or review a received call and choose to use it. Calls never
 * change it, so the Variables the steps use and the payload Test run sends stay put. Enabling the
 * workflow requires it.
 */
export const WebhookPayloadSection = ({
  workflowId,
  url,
  sample,
  lastCall,
  canSetSample,
}: Readonly<{
  readonly workflowId: string;
  readonly url: string;
  readonly sample: TExpectedPayload | null;
  readonly lastCall: TLastCall | null;
  readonly canSetSample: boolean;
}>) => {
  const editor = usePayloadEditor(workflowId);
  const [isWriting, setIsWriting] = useState(false);
  const startWriting = (initial: string) => {
    setIsWriting(true);
    editor.setDraft(initial);
  };

  // Stays on the same card when the first save sets the payload, so typing carries on uninterrupted.
  if (sample || isWriting) {
    return (
      <ExpectedPayloadCard sample={sample} lastCall={lastCall} editor={editor} canSetSample={canSetSample} />
    );
  }
  if (lastCall) {
    return (
      <ReceivedCallCard
        lastCall={lastCall}
        editor={editor}
        canSetSample={canSetSample}
        onEditFirst={() => startWriting(formatPayload(lastCall.payload))}
      />
    );
  }
  return <NoPayloadCard url={url} canSetSample={canSetSample} onWrite={() => startWriting("")} />;
};

/** The set expected payload when the editor isn't shown: the call under review, or the Variables. */
const ExpectedPayloadBody = ({
  sample,
  view,
  reviewedCall,
}: Readonly<{
  sample: TExpectedPayload;
  view: TPayloadView;
  reviewedCall: TLastCall | null;
}>) => {
  const { t } = useTranslation();
  if (reviewedCall) {
    return (
      <>
        <p className="px-3 pt-2 text-xs font-medium text-slate-600">
          {t("workspace.workflows.webhook_call_payload")}
        </p>
        <CallPayload call={reviewedCall} view={view} />
      </>
    );
  }
  return (
    <>
      <VariableRows variables={sample.variables} />
      <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
        {t("workspace.workflows.webhook_sample_variables_help")}
      </p>
    </>
  );
};
