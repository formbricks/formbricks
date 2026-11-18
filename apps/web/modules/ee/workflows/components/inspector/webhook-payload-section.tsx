"use client";

import { CopyIcon, InboxIcon, LockIcon, PencilIcon } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
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
import { useStoredTestPayload } from "@/modules/ee/workflows/hooks/use-stored-test-payload";
import { useWorkflowWebhookMutations } from "@/modules/ee/workflows/hooks/use-workflow-webhook";
import { formatCallerIp } from "@/modules/ee/workflows/lib/caller-ip";
import {
  formatPayload,
  maskWebhookSecretUrl,
  parsePastedSample,
  toVariableListRows,
} from "@/modules/ee/workflows/lib/webhook-trigger-panel";
import { Button } from "@/modules/ui/components/button";
import { CodeBlock } from "@/modules/ui/components/code-block";

const SAVE_DELAY_MS = 800;
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
  const options: { value: TPayloadView; label: string }[] = [
    { value: "variables", label: t("workspace.workflows.webhook_payload_view_variables") },
    { value: "json", label: t("workspace.workflows.webhook_payload_view_json") },
  ];
  return (
    <div
      role="radiogroup"
      aria-label={t("workspace.workflows.webhook_payload_view")}
      className="flex shrink-0 rounded-md bg-slate-100 p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded px-2 py-0.5 text-xs text-slate-600 transition-colors",
            value === option.value && "bg-white font-medium text-slate-900 shadow-xs"
          )}>
          {option.label}
        </button>
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

/**
 * The expected payload's JSON editor. Saves a valid object a moment after typing stops, and clears the
 * Test run drawer's browser copy so Test run sends what was saved.
 */
const usePayloadEditor = (workflowId: string) => {
  const { t } = useTranslation();
  const { setSample } = useWorkflowWebhookMutations(workflowId);
  const [, setStoredTestPayload] = useStoredTestPayload(workflowId);
  const [draft, setDraft] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    []
  );

  const save = (payload: Record<string, unknown>, onSaved?: () => void) =>
    setSample.mutate(payload, {
      onSuccess: () => {
        setDraft(null);
        setStoredTestPayload(null);
        onSaved?.();
      },
      onError: (error) =>
        toast.error(getV3ApiErrorMessage(error, t("workspace.workflows.webhook_payload_save_failed"))),
    });

  const edit = (next: string, onSaved?: () => void) => {
    setDraft(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const check = next.trim() === "" ? null : parsePastedSample(next);
    if (!check?.ok) return;
    saveTimer.current = setTimeout(() => save(check.payload, onSaved), SAVE_DELAY_MS);
  };

  const parsed = draft === null || draft.trim() === "" ? null : parsePastedSample(draft);
  return { draft, setDraft, parsed, edit, save, isPending: setSample.isPending };
};

type TEditor = ReturnType<typeof usePayloadEditor>;

/** The JSON editor for the expected payload, with the reason a pasted payload can't be used. */
const PayloadJsonEditor = ({
  editor,
  sample,
  canSetSample,
  onSaved,
}: Readonly<{
  editor: TEditor;
  sample: TExpectedPayload | null;
  canSetSample: boolean;
  onSaved: () => void;
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
        onChange={canSetSample ? (next) => editor.edit(next, onSaved) : undefined}
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
  editor,
  canSetSample,
  isWriting,
  onWrite,
  onSaved,
}: Readonly<{
  url: string;
  editor: TEditor;
  canSetSample: boolean;
  isWriting: boolean;
  onWrite: () => void;
  onSaved: () => void;
}>) => (
  <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
    <PayloadHeader aside={<RequiredTag />} />
    {isWriting ? (
      <div className="border-t border-slate-100 p-3">
        <PayloadJsonEditor editor={editor} sample={null} canSetSample={canSetSample} onSaved={onSaved} />
      </div>
    ) : (
      <WaitingForCall url={url} canSetSample={canSetSample} onWrite={onWrite} />
    )}
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

/** An expected payload is set. A newer call with different fields is offered, never applied on its own. */
const SetPayloadCard = ({
  sample,
  lastCall,
  editor,
  canSetSample,
}: Readonly<{
  sample: TExpectedPayload;
  lastCall: TLastCall | null;
  editor: TEditor;
  canSetSample: boolean;
}>) => {
  const { t } = useTranslation();
  const relativeTime = useRelativeTime();
  const [view, setView] = useState<TPayloadView>("variables");
  const [isReviewing, setIsReviewing] = useState(false);
  const [dismissedCallAt, setDismissedCallAt] = useState<string | null>(null);
  const newerCall = isNewerDifferentCall(lastCall, sample, dismissedCallAt) ? lastCall : null;
  const footer =
    editor.draft !== null && editor.parsed?.ok === true
      ? t("workspace.workflows.webhook_payload_saving")
      : t("workspace.workflows.webhook_expected_payload_owned", { time: relativeTime(sample.updatedAt) });

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <PayloadHeader aside={<ViewSwitch value={view} onChange={setView} />} />
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
        <ExpectedPayloadBody
          sample={sample}
          view={view}
          reviewedCall={isReviewing ? newerCall : null}
          jsonEditor={
            <PayloadJsonEditor
              editor={editor}
              sample={sample}
              canSetSample={canSetSample}
              onSaved={() => {}}
            />
          }
        />
      </div>
      <footer className="flex items-start gap-1.5 border-t border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <LockIcon className="mt-px size-3.5 shrink-0" aria-hidden />
        <span>{footer}</span>
      </footer>
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

  if (sample) {
    return <SetPayloadCard sample={sample} lastCall={lastCall} editor={editor} canSetSample={canSetSample} />;
  }
  if (lastCall && !isWriting) {
    return (
      <ReceivedCallCard
        lastCall={lastCall}
        editor={editor}
        canSetSample={canSetSample}
        onEditFirst={() => startWriting(formatPayload(lastCall.payload))}
      />
    );
  }
  return (
    <NoPayloadCard
      url={url}
      editor={editor}
      canSetSample={canSetSample}
      isWriting={isWriting}
      onWrite={() => startWriting("")}
      onSaved={() => setIsWriting(false)}
    />
  );
};

/** The set expected payload: the call under review, the JSON editor, or the Variables. */
const ExpectedPayloadBody = ({
  sample,
  view,
  reviewedCall,
  jsonEditor,
}: Readonly<{
  sample: TExpectedPayload;
  view: TPayloadView;
  reviewedCall: TLastCall | null;
  jsonEditor: ReactNode;
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
  if (view === "json") return <div className="p-3">{jsonEditor}</div>;
  return (
    <>
      <VariableRows variables={sample.variables} />
      <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
        {t("workspace.workflows.webhook_sample_variables_help")}
      </p>
    </>
  );
};
