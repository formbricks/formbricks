"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { ArrowRightIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  type TWorkflowSendEmailActionNode,
  type TWorkflowSendEmailContentField,
  getBlankSendEmailContentFields,
} from "@formbricks/workflows";
import { WorkflowEmailRecipientField } from "@/modules/ee/workflows/components/inspector/workflow-email-recipient-field";
import {
  WorkflowFieldError,
  WorkflowFieldLabel,
} from "@/modules/ee/workflows/components/inspector/workflow-field";
import { useWorkflowEmailAuthoringContext } from "@/modules/ee/workflows/components/workflow-email-authoring-context";
import { useWorkflowNodeFieldFocus } from "@/modules/ee/workflows/hooks/use-workflow-node-field-focus";
import { resolveBoundTriggerSurvey } from "@/modules/ee/workflows/lib/bound-survey";
import { openWorkflowNodeConfigModalAtom, workflowDefinitionAtom } from "@/modules/ee/workflows/state/editor";
import FollowUpActionMultiEmailInput from "@/modules/survey/follow-ups/components/follow-up-action-multi-email-input";
import {
  type EmailSendToOption,
  buildEmailSendToOptions,
} from "@/modules/survey/follow-ups/lib/email-send-to-options";
import { Button } from "@/modules/ui/components/button";
import { Editor } from "@/modules/ui/components/editor";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { Switch } from "@/modules/ui/components/switch";

interface WorkflowEmailActionFormProps {
  node: TWorkflowSendEmailActionNode;
  isEditable: boolean;
  onChange: (next: TWorkflowSendEmailActionNode) => void;
}

// The internal "default language" slot recall/headline resolution uses when no language is selected.
const DEFAULT_LANGUAGE_CODE = "default";

const HTML_TAG_PATTERN = /<[a-z][\s\S]*>/i;

const escapeHtml = (value: string): string =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

// The recall Editor loads its initial value as HTML (root can only hold block nodes). Recall-token
// bodies are already `<p>…</p>` HTML and pass through untouched; legacy plain-text bodies (e.g. the
// seed's "Hi there…") are escaped and wrapped in paragraphs so Lexical doesn't crash on a bare text
// node ("Only element or decorator nodes can be inserted to the root node").
const toEditorHtml = (body: string): string => {
  if (!body) return "";
  if (HTML_TAG_PATTERN.test(body)) return body;
  return body
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br>")}</p>`)
    .join("");
};

// The DOM ids the focus jump targets. `body` has no input of its own — the Lexical editor owns a
// contenteditable inside its wrapper — so it is focused through a ref instead.
const FIELD_INPUT_IDS: Record<Exclude<TWorkflowSendEmailContentField, "body">, string> = {
  to: "workflow-email-to",
  subject: "workflow-email-subject",
};

export const WorkflowEmailActionForm = ({
  node,
  isEditable,
  onChange,
}: Readonly<WorkflowEmailActionFormProps>) => {
  const { t } = useTranslation();
  const authoringContext = useWorkflowEmailAuthoringContext();
  const definition = useAtomValue(workflowDefinitionAtom);
  const openNodeConfigModal = useSetAtom(openWorkflowNodeConfigModalAtom);
  const [firstRender, setFirstRender] = useState(true);

  // Which required fields may show their error. A freshly added node stays clean until the user
  // has actually engaged with a field and left it empty (or arrived here from the problems
  // dialog); flagging an untouched brand-new node would paint three errors on open.
  const [touchedFields, setTouchedFields] = useState<Partial<Record<TWorkflowSendEmailContentField, true>>>(
    {}
  );
  const markTouched = useCallback(
    (...fields: TWorkflowSendEmailContentField[]) =>
      setTouchedFields((current) =>
        fields.every((field) => current[field])
          ? current
          : { ...current, ...Object.fromEntries(fields.map((field) => [field, true as const])) }
      ),
    []
  );

  const bodyWrapperRef = useRef<HTMLDivElement>(null);

  // Stable identity: EditorContentChecker re-registers its update listener whenever this changes.
  // Non-empty is what earns the body its "touched" flag, so typing-then-clearing shows the error
  // while a node that arrived empty stays quiet.
  const handleBodyEmptyChange = useCallback(
    (isEmpty: boolean) => {
      if (!isEmpty) markTouched("body");
    },
    [markTouched]
  );

  const updateConfig = (next: Partial<TWorkflowSendEmailActionNode["config"]>) =>
    onChange({ ...node, config: { ...node.config, ...next } });

  const invalidFields = new Set(
    getBlankSendEmailContentFields(node.config).filter((field) => touchedFields[field])
  );

  // Arriving from the validation problems dialog: reveal every missing field on this node (the
  // point of the jump is to answer "which field is wrong") and focus the one it pointed at.
  useWorkflowNodeFieldFocus({
    nodeId: node.id,
    onRequest: () => markTouched(...getBlankSendEmailContentFields(node.config)),
    resolveElement: (field) =>
      field === "body"
        ? bodyWrapperRef.current?.querySelector<HTMLElement>('[contenteditable="true"]')
        : document.getElementById(FIELD_INPUT_IDS[field as keyof typeof FIELD_INPUT_IDS]),
  });

  const triggerSurveyId = definition?.trigger?.type === "trigger" ? definition.trigger.config.surveyId : null;
  const survey = resolveBoundTriggerSurvey(authoringContext, definition);

  // Clear the recipient + body when the trigger's bound survey changes: `config.to` is an element/
  // hidden-field id and `config.body` holds recall tokens, both of which dangle against the previous
  // survey's elements. Mirrors how the trigger form clears `endingCardIds` on survey change. Skips the
  // initial mount so loading an existing node never wipes its saved values.
  const previousTriggerSurveyId = useRef<string | null>(triggerSurveyId);
  useEffect(() => {
    if (previousTriggerSurveyId.current === triggerSurveyId) return;
    previousTriggerSurveyId.current = triggerSurveyId;
    if (node.config.to === "" && node.config.body === "") return;
    updateConfig({ to: "", body: "" });
    // These two were wiped out from under the user, so their errors are exactly what they need to
    // see — no interaction required to earn them.
    markTouched("to", "body");
    // updateConfig/node are intentionally omitted: this reacts to the survey id changing, not to each
    // keystroke in to/body (which would clear them mid-edit).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerSurveyId]);

  const emailSendToOptions: EmailSendToOption[] = useMemo(() => {
    if (!survey || !authoringContext) return [];
    return buildEmailSendToOptions({
      survey,
      teamMemberDetails: authoringContext.teamMemberDetails,
      userEmail: authoringContext.userEmail,
      selectedLanguageCode: DEFAULT_LANGUAGE_CODE,
      t,
    });
  }, [survey, authoringContext, t]);

  // Without a resolvable bound survey there is nothing meaningful to author — the recipient
  // options and recall body both come from the survey. Point the user at the trigger instead of
  // rendering degraded plain inputs (and the seed's placeholder values).
  if (!survey) {
    return (
      <div className="flex flex-col gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
        <p className="text-sm text-slate-600">{t("workspace.workflows.email_needs_survey")}</p>
        {definition?.trigger ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="w-fit"
            onClick={() => {
              const triggerId = definition.trigger?.id;
              if (triggerId) openNodeConfigModal(triggerId);
            }}>
            {t("workspace.workflows.email_set_up_trigger")}
            <ArrowRightIcon />
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <WorkflowEmailRecipientField
        options={emailSendToOptions}
        value={node.config.to}
        isEditable={isEditable}
        isInvalid={invalidFields.has("to")}
        onChange={(value) => updateConfig({ to: value })}
        // A picked recipient can't be un-picked, so closing the dropdown without choosing is this
        // control's only "touched while still empty" moment.
        onClose={() => markTouched("to")}
      />

      {/* From (read-only) */}
      <div className="flex flex-col gap-2">
        <Label>{t("workspace.workflows.email_from_label")}</Label>
        <p className="text-xs text-slate-500">
          {t("workspace.surveys.edit.follow_ups_modal_action_from_description")}
        </p>
        <div className="w-fit rounded-md border border-slate-200 bg-slate-100 px-2 py-1">
          {/* The real deployment sender (MAIL_FROM), not `config.from` — parity with Follow-Ups, which
              always sends from MAIL_FROM. `config.from` is a vestigial seed value, never the send sender. */}
          <span className="text-sm text-slate-900">{authoringContext?.mailFrom ?? node.config.from}</span>
        </div>
      </div>

      {/* Reply To */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="workflow-email-reply-to">{t("workspace.workflows.email_reply_to_label")}</Label>
        <p className="text-xs text-slate-500">
          {t("workspace.surveys.edit.follow_ups_modal_action_replyTo_description")}
        </p>
        <FollowUpActionMultiEmailInput
          disabled={!isEditable}
          emails={node.config.replyTo}
          setEmails={(update) => {
            const nextReplyTo = typeof update === "function" ? update(node.config.replyTo) : update;
            updateConfig({ replyTo: nextReplyTo });
          }}
        />
      </div>

      {/* Subject */}
      <div className="flex flex-col gap-2">
        <WorkflowFieldLabel
          htmlFor="workflow-email-subject"
          isRequired
          isInvalid={invalidFields.has("subject")}>
          {t("workspace.workflows.email_subject_label")}
        </WorkflowFieldLabel>
        <Input
          id="workflow-email-subject"
          value={node.config.subject}
          disabled={!isEditable}
          placeholder={t("workspace.workflows.email_subject_placeholder")}
          isInvalid={invalidFields.has("subject")}
          aria-invalid={invalidFields.has("subject")}
          aria-describedby={invalidFields.has("subject") ? "workflow-email-subject-error" : undefined}
          onBlur={() => markTouched("subject")}
          onChange={(event) => updateConfig({ subject: event.target.value })}
        />
        {invalidFields.has("subject") ? (
          <WorkflowFieldError id="workflow-email-subject-error">
            {t("workspace.workflows.email_subject_required")}
          </WorkflowFieldError>
        ) : null}
      </div>

      {/* Body (recall editor) */}
      {/* The editor defaults to a 2-line min-height (48px); a 4-line body (24px line-height)
          better matches the amount of content an email body usually holds. */}
      <div className="flex flex-col gap-2 [--editor-min-height:96px]" ref={bodyWrapperRef}>
        <WorkflowFieldLabel id="workflow-email-body-label" isRequired isInvalid={invalidFields.has("body")}>
          {t("workspace.workflows.email_body_label")}
        </WorkflowFieldLabel>
        <Editor
          // The editor's contenteditable takes its accessible name from this label.
          id="workflow-email-body-label"
          disableLists
          excludedToolbarItems={["blockType"]}
          getText={() => toEditorHtml(node.config.body)}
          setText={(value: string) => updateConfig({ body: value })}
          // The editor is the authority on its own emptiness: its serialized value keeps the
          // enclosing `<p>` even when blank, so "had content at some point" is the only reliable
          // signal that the user has engaged with this field.
          onEmptyChange={handleBodyEmptyChange}
          isInvalid={invalidFields.has("body")}
          ariaDescribedBy={invalidFields.has("body") ? "workflow-email-body-error" : undefined}
          firstRender={firstRender}
          setFirstRender={setFirstRender}
          editable={isEditable}
          placeholder={t("workspace.workflows.email_body_placeholder")}
          localSurvey={survey}
          elementId={node.id}
          selectedLanguageCode={DEFAULT_LANGUAGE_CODE}
        />
        {invalidFields.has("body") ? (
          <WorkflowFieldError id="workflow-email-body-error">
            {t("workspace.workflows.email_body_required")}
          </WorkflowFieldError>
        ) : null}
      </div>

      <div className="flex items-start justify-between gap-3 rounded-md border border-slate-200 p-3">
        <div className="flex flex-col">
          <Label htmlFor="workflow-email-attach-response-data" className="text-sm font-medium">
            {t("workspace.workflows.email_attach_response_data_label")}
          </Label>
          <p className="text-xs text-slate-500">
            {t("workspace.workflows.email_attach_response_data_description")}
          </p>
        </div>
        <Switch
          id="workflow-email-attach-response-data"
          checked={node.config.attachResponseData}
          disabled={!isEditable}
          onCheckedChange={(checked) => updateConfig({ attachResponseData: checked })}
        />
      </div>

      {node.config.attachResponseData ? (
        <div className="flex flex-col gap-3 rounded-md border border-slate-200 p-3">
          <div className="flex items-start justify-between gap-3">
            <Label htmlFor="workflow-email-include-variables" className="text-sm font-medium">
              {t("workspace.workflows.email_include_variables_label")}
            </Label>
            <Switch
              id="workflow-email-include-variables"
              checked={node.config.includeVariables ?? false}
              disabled={!isEditable}
              onCheckedChange={(checked) => updateConfig({ includeVariables: checked })}
            />
          </div>
          <div className="flex items-start justify-between gap-3">
            <Label htmlFor="workflow-email-include-hidden-fields" className="text-sm font-medium">
              {t("workspace.workflows.email_include_hidden_fields_label")}
            </Label>
            <Switch
              id="workflow-email-include-hidden-fields"
              checked={node.config.includeHiddenFields ?? false}
              disabled={!isEditable}
              onCheckedChange={(checked) => updateConfig({ includeHiddenFields: checked })}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
};
