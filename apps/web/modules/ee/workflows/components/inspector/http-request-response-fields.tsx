"use client";

import { PencilIcon } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { type TWorkflowSampleListItem, detectWebhookVariables } from "@formbricks/workflows";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import {
  CallNotice,
  type TPayloadView,
  VariableRows,
  ViewSwitch,
} from "@/modules/ee/workflows/components/inspector/webhook-payload-section";
import {
  usePasteErrorMessage,
  useRelativeTime,
} from "@/modules/ee/workflows/components/inspector/webhook-trigger-labels";
import { WorkflowFieldError } from "@/modules/ee/workflows/components/inspector/workflow-field";
import { JsonEditor } from "@/modules/ee/workflows/components/json-editor/json-editor";
import { useJsonSampleDraft } from "@/modules/ee/workflows/hooks/use-json-sample-draft";
import { useSetExpectedResponse } from "@/modules/ee/workflows/hooks/use-workflow-webhook";
import { formatPayload } from "@/modules/ee/workflows/lib/webhook-trigger-panel";
import { Button } from "@/modules/ui/components/button";

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A sample's JSON body, or null when the answer wasn't a JSON object (text, a list, cut off). */
const getObjectBody = (entry: TWorkflowSampleListItem | null): Record<string, unknown> | null => {
  if (!entry || entry.sample.bodyTruncated === true) return null;
  return isPlainObject(entry.sample.body) ? entry.sample.body : null;
};

/** The expected response body's JSON editor state: saves a valid object a moment after typing stops. */
const useResponseEditor = (workflowId: string, stepId: string) => {
  const { t } = useTranslation();
  const mutation = useSetExpectedResponse(workflowId, stepId);
  const editor = useJsonSampleDraft((body, { onSuccess }) =>
    mutation.mutate(body, {
      onSuccess,
      onError: (error) =>
        toast.error(getV3ApiErrorMessage(error, t("workspace.workflows.http_response_fields_save_failed"))),
    })
  );
  return { ...editor, isPending: mutation.isPending };
};

type TResponseEditor = ReturnType<typeof useResponseEditor>;

/** The body's fields as Variables (the status is always one), or its JSON, editable when allowed. */
const ResponseBody = ({
  stepId,
  body,
  view,
  editor,
  isEditable,
}: Readonly<{
  stepId: string;
  body: Record<string, unknown> | null;
  view: TPayloadView;
  editor: TResponseEditor | null;
  isEditable: boolean;
}>) => {
  const { t } = useTranslation();
  const pasteErrorMessage = usePasteErrorMessage();
  if (view === "json") {
    const reason = editor?.parsed && !editor.parsed.ok ? editor.parsed.reason : null;
    return (
      <div className="ph-no-capture p-3">
        <JsonEditor
          id={`workflow-http-response-fields-${stepId}`}
          label={t("workspace.workflows.http_response_fields")}
          value={editor?.draft ?? (body ? formatPayload(body) : "")}
          onChange={editor && isEditable ? editor.edit : undefined}
          allowEmpty
          placeholder='{ "id": "tk_123", "status": "open" }'
        />
        <p className="mt-1.5 text-xs text-slate-500">
          {t("workspace.workflows.http_response_fields_json_hint")}
        </p>
        {reason && reason !== "invalid_json" ? (
          <WorkflowFieldError id={`workflow-http-response-fields-${stepId}-error`}>
            {pasteErrorMessage(reason)}
          </WorkflowFieldError>
        ) : null}
      </div>
    );
  }
  if (!body) return null;
  return (
    <>
      <VariableRows variables={detectWebhookVariables(body)} />
      <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
        {t("workspace.workflows.http_response_fields_variables_help")}
      </p>
    </>
  );
};

type TOfferedTest = { at: string; body: Record<string, unknown> };

/**
 * A test response worth offering: a JSON object, not dismissed, and either the first answer while no
 * expected response body is set, or a newer one than it with a different body.
 */
const getOfferedTest = (
  expected: TWorkflowSampleListItem | null,
  lastTest: TWorkflowSampleListItem | null,
  dismissedTestAt: string | null
): TOfferedTest | null => {
  const testBody = getObjectBody(lastTest);
  if (!lastTest || !testBody || lastTest.updatedAt === dismissedTestAt) return null;
  if (!expected) return { at: lastTest.updatedAt, body: testBody };
  const isNewer = Date.parse(lastTest.updatedAt) > Date.parse(expected.updatedAt);
  const isDifferent = JSON.stringify(testBody) !== JSON.stringify(getObjectBody(expected));
  return isNewer && isDifferent ? { at: lastTest.updatedAt, body: testBody } : null;
};

/** What a test response offers: use it while nothing is set, else review it against the current one. */
const TestResponseNotice = ({
  offeredTest,
  isFirst,
  editor,
  isEditable,
  isReviewing,
  onReview,
  onEditFirst,
  onDone,
}: Readonly<{
  offeredTest: TOfferedTest;
  isFirst: boolean;
  editor: TResponseEditor;
  isEditable: boolean;
  isReviewing: boolean;
  onReview: () => void;
  onEditFirst: () => void;
  onDone: (dismissed: boolean) => void;
}>) => {
  const { t } = useTranslation();
  const relativeTime = useRelativeTime();
  const time = relativeTime(offeredTest.at);
  const renderUseButton = (label: string, onSaved?: () => void) => (
    <Button
      type="button"
      size="sm"
      disabled={!isEditable || editor.isPending}
      loading={editor.isPending}
      onClick={() => editor.save(offeredTest.body, onSaved)}>
      {label}
    </Button>
  );
  if (isFirst) {
    return (
      <CallNotice message={t("workspace.workflows.http_response_test_arrived", { time })}>
        {renderUseButton(t("workspace.workflows.http_response_test_use"))}
        <Button type="button" variant="ghost" size="sm" disabled={!isEditable} onClick={onEditFirst}>
          <PencilIcon />
          {t("workspace.workflows.webhook_call_edit_first")}
        </Button>
      </CallNotice>
    );
  }
  return (
    <CallNotice message={t("workspace.workflows.http_response_test_newer", { time })}>
      {isReviewing ? (
        <>
          {renderUseButton(t("workspace.workflows.webhook_call_use_instead"), () => onDone(false))}
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
 * An HTTP request step's expected response body (ADR 0054): the body its API answers with, whose fields the
 * later steps use as Variables. Editors own it, like the Webhook trigger's expected payload: they write
 * or paste it, or choose to use a Test request's response. A Test request never changes it.
 */
export const HttpResponseFieldsCard = ({
  stepId,
  workflowId,
  expected,
  lastTest,
  isEditable,
}: Readonly<{
  readonly stepId: string;
  readonly workflowId: string;
  readonly expected: TWorkflowSampleListItem | null;
  readonly lastTest: TWorkflowSampleListItem | null;
  readonly isEditable: boolean;
}>) => {
  const { t } = useTranslation();
  const relativeTime = useRelativeTime();
  const editor = useResponseEditor(workflowId, stepId);
  const [view, setView] = useState<TPayloadView>("variables");
  const [isReviewing, setIsReviewing] = useState(false);
  const [dismissedTestAt, setDismissedTestAt] = useState<string | null>(null);
  const expectedBody = getObjectBody(expected);

  const offeredTest = getOfferedTest(expected, lastTest, dismissedTestAt);
  const isWriting = editor.draft !== null;

  const notice = offeredTest ? (
    <TestResponseNotice
      offeredTest={offeredTest}
      isFirst={!expected}
      editor={editor}
      isEditable={isEditable}
      isReviewing={isReviewing}
      onReview={() => setIsReviewing(true)}
      onEditFirst={() => {
        editor.setDraft(formatPayload(offeredTest.body));
        setView("json");
      }}
      onDone={(dismissed) => {
        setIsReviewing(false);
        if (dismissed) setDismissedTestAt(offeredTest.at);
      }}
    />
  ) : null;

  // What the card shows: the test response under review or offered, else the expected response body.
  const shownBody =
    (isReviewing || (!expected && !isWriting)) && offeredTest ? offeredTest.body : expectedBody;
  const showsEditor = expected !== null || isWriting;

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <header className="flex items-start justify-between gap-3 px-3 py-2.5">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-semibold text-slate-900">
            {t("workspace.workflows.http_response_fields")}
          </h3>
          <p className="text-xs text-slate-500">{t("workspace.workflows.http_response_fields_help")}</p>
        </div>
        {expected || offeredTest || isWriting ? <ViewSwitch value={view} onChange={setView} /> : null}
      </header>
      {notice}
      {expected || offeredTest || isWriting ? (
        <div className="border-t border-slate-100">
          <ResponseBody
            stepId={stepId}
            body={shownBody}
            view={view}
            editor={showsEditor && !isReviewing ? editor : null}
            isEditable={isEditable}
          />
        </div>
      ) : (
        <div className="flex flex-col items-start gap-2 border-t border-slate-100 px-3 py-3">
          <p className="text-xs text-slate-500">{t("workspace.workflows.http_response_fields_empty")}</p>
          {isEditable ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                editor.setDraft("");
                setView("json");
              }}>
              <PencilIcon />
              {t("workspace.workflows.http_response_fields_write")}
            </Button>
          ) : null}
        </div>
      )}
      {expected ? (
        <footer className="border-t border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          {editor.hasUnsavedEdit
            ? t("workspace.workflows.webhook_payload_saving")
            : t("workspace.workflows.http_response_fields_owned", {
                time: relativeTime(expected.updatedAt),
              })}
        </footer>
      ) : null}
    </section>
  );
};
