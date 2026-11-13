"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { ArrowRightIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  type TWorkflowSendEmailActionNode,
  type TWorkflowSendEmailContentField,
  WORKFLOW_SURVEY_LINK_TOKEN,
  WORKFLOW_TRIGGERS,
  getBlankSendEmailContentFields,
  getIncludeEmbeddedData,
  getTriggerSurveyId,
  isVariableEmailRecipient,
} from "@formbricks/workflows";
import { WorkflowEmailRecipientField } from "@/modules/ee/workflows/components/inspector/workflow-email-recipient-field";
import { WorkflowEmailSurveyLinkSection } from "@/modules/ee/workflows/components/inspector/workflow-email-survey-link-section";
import {
  WorkflowFieldError,
  WorkflowFieldLabel,
} from "@/modules/ee/workflows/components/inspector/workflow-field";
import { useWorkflowVariablePicker } from "@/modules/ee/workflows/components/variable-picker/use-workflow-variable-picker";
import { useWorkflowEmailAuthoringContext } from "@/modules/ee/workflows/components/workflow-email-authoring-context";
import { useWorkflowNodeFieldFocus } from "@/modules/ee/workflows/hooks/use-workflow-node-field-focus";
import { resolveBoundTriggerSurvey } from "@/modules/ee/workflows/lib/bound-survey";
import {
  fromRecipientSelectValue,
  getRecipientVariableOptions,
  toRecipientSelectValue,
} from "@/modules/ee/workflows/lib/email-recipient";
import {
  appendSurveyLinkToken,
  hasSurveyLinkToken,
  withSurveyLinkSurvey,
  withoutSurveyLink,
} from "@/modules/ee/workflows/lib/email-survey-link";
import {
  getSendEmailBodyRecall,
  withWorkflowVariableItems,
} from "@/modules/ee/workflows/lib/variable-picker";
import { openWorkflowNodeConfigModalAtom, workflowDefinitionAtom } from "@/modules/ee/workflows/state/editor";
import FollowUpActionMultiEmailInput from "@/modules/survey/follow-ups/components/follow-up-action-multi-email-input";
import {
  type EmailSendToOption,
  buildEmailSendToOptions,
} from "@/modules/survey/follow-ups/lib/email-send-to-options";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { Editor } from "@/modules/ui/components/editor";
import {
  type TEditorRecallSource,
  createSurveyRecallSource,
} from "@/modules/ui/components/editor/components/recall-source";
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

// Index scans, not `/<[a-z][\s\S]*>/i`: that pattern is O(N^2) on a long run of `<a` with no `>`,
// since the greedy `[\s\S]*` rescans to the end from every one. Identical predicate — `[\s\S]*`
// matches anything, so the regex holds exactly when some `<` + letter is followed later by any `>`,
// i.e. when the LAST `>` sits after the FIRST `<letter`.
const HTML_OPENING_TAG_PATTERN = /<[a-z]/i;

const containsHtmlTag = (value: string): boolean => {
  const openingTag = HTML_OPENING_TAG_PATTERN.exec(value);
  if (!openingTag) return false;

  return value.lastIndexOf(">") > openingTag.index + 1;
};

const escapeHtml = (value: string): string =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

// The recall Editor loads its initial value as HTML (root can only hold block nodes). Recall-token
// bodies are already `<p>…</p>` HTML and pass through untouched; legacy plain-text bodies (e.g. the
// seed's "Hi there…") are escaped and wrapped in paragraphs so Lexical doesn't crash on a bare text
// node ("Only element or decorator nodes can be inserted to the root node").
const toEditorHtml = (body: string): string => {
  if (!body) return "";
  if (containsHtmlTag(body)) return body;
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
  // Bumped to re-seed the body editor after the form changes the body itself (the survey link).
  const [bodyEditorKey, setBodyEditorKey] = useState(0);

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

  const triggerSurveyId = getTriggerSurveyId(definition?.trigger);
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

  // A Webhook workflow has no survey: its email goes to team members (or, ENG-7182, a Variable) and
  // its body inserts Variables from the payload and earlier steps (ENG-7113).
  const isWebhookTrigger = definition?.trigger?.triggerType === WORKFLOW_TRIGGERS.WEBHOOK;
  const variablePicker = useWorkflowVariablePicker({ nodeId: node.id });
  const bodyRecall = getSendEmailBodyRecall(definition?.trigger, node.config.to);
  const bodyRecallSource: TEditorRecallSource | undefined = useMemo(() => {
    if (bodyRecall === "variables") return variablePicker.recallSource;
    if (bodyRecall === "survey" && survey) {
      // The survey picker as before; Variable tokens written through the API still show as chips.
      return withWorkflowVariableItems(
        createSurveyRecallSource(survey, node.id, DEFAULT_LANGUAGE_CODE),
        variablePicker.groups
      );
    }
    return undefined;
  }, [bodyRecall, survey, node.id, variablePicker.recallSource, variablePicker.groups]);

  const emailSendToOptions: EmailSendToOption[] = useMemo(() => {
    if ((!survey && !isWebhookTrigger) || !authoringContext) return [];
    return buildEmailSendToOptions({
      survey,
      teamMemberDetails: authoringContext.teamMemberDetails,
      userEmail: authoringContext.userEmail,
      selectedLanguageCode: DEFAULT_LANGUAGE_CODE,
      t,
    });
  }, [survey, isWebhookTrigger, authoringContext, t]);

  // Without a resolvable bound survey there is nothing meaningful to author — the recipient
  // options and recall body both come from the survey. Point the user at the trigger instead of
  // rendering degraded plain inputs (and the seed's placeholder values).
  if (!survey && !isWebhookTrigger) {
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

  // The body only changes from outside the editor here; re-seed it so it shows the new text.
  const replaceBody = (next: Partial<TWorkflowSendEmailActionNode["config"]>) => {
    updateConfig(next);
    setFirstRender(true);
    setBodyEditorKey((key) => key + 1);
  };
  const isVariableRecipient = isVariableEmailRecipient(node.config.to);

  return (
    <div className="flex flex-col gap-4">
      <WorkflowEmailRecipientField
        options={emailSendToOptions}
        // A Webhook workflow can also send to an address in the payload (ENG-7169).
        variableOptions={
          isWebhookTrigger ? getRecipientVariableOptions(variablePicker.groups, node.config.to) : []
        }
        value={toRecipientSelectValue(node.config.to)}
        isEditable={isEditable}
        isInvalid={invalidFields.has("to")}
        onChange={(value) => updateConfig({ to: fromRecipientSelectValue(value) })}
        // A picked recipient can't be un-picked, so closing the dropdown without choosing is this
        // control's only "touched while still empty" moment.
        onClose={() => markTouched("to")}
      />
      {isVariableRecipient ? (
        <Alert variant="info">
          <AlertDescription>{t("workspace.workflows.email_variable_recipient_fixed_body")}</AlertDescription>
        </Alert>
      ) : null}

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
          key={bodyEditorKey}
          // The editor's contenteditable takes its accessible name from this label.
          id="workflow-email-body-label"
          disableLists
          // No @ button when the body takes no recall (a Variable recipient: the email must be fixed).
          excludedToolbarItems={bodyRecallSource ? ["blockType"] : ["blockType", "recall"]}
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
          recallSource={bodyRecallSource}
        />
        {invalidFields.has("body") ? (
          <WorkflowFieldError id="workflow-email-body-error">
            {t("workspace.workflows.email_body_required")}
          </WorkflowFieldError>
        ) : null}
        {/* The editor shows the survey link token as plain text (it has no chip for it), so say what it is. */}
        {hasSurveyLinkToken(node.config.body) ? (
          <p className="text-xs text-slate-500">
            {t("workspace.workflows.email_survey_link_token_help", { token: WORKFLOW_SURVEY_LINK_TOKEN })}
          </p>
        ) : null}
      </div>

      <WorkflowEmailSurveyLinkSection
        config={node.config}
        isEditable={isEditable}
        onPickSurvey={(surveyId) => replaceBody(withSurveyLinkSurvey(node.config, surveyId))}
        onRemove={() => replaceBody(withoutSurveyLink(node.config))}
        onInsertLink={() => replaceBody({ body: appendSurveyLinkToken(node.config.body) })}
        onChangeEmbeddedData={(embeddedData) =>
          node.config.surveyLink && updateConfig({ surveyLink: { ...node.config.surveyLink, embeddedData } })
        }
        requestVariable={variablePicker.requestVariable}
      />

      {/* A Webhook run has no response to attach. */}
      {isWebhookTrigger ? null : (
        <WorkflowEmailResponseDataFields node={node} isEditable={isEditable} updateConfig={updateConfig} />
      )}
      {variablePicker.pickerElement}
    </div>
  );
};

const WorkflowEmailResponseDataFields = ({
  node,
  isEditable,
  updateConfig,
}: Readonly<{
  node: TWorkflowSendEmailActionNode;
  isEditable: boolean;
  updateConfig: (next: Partial<TWorkflowSendEmailActionNode["config"]>) => void;
}>) => {
  const { t } = useTranslation();
  return (
    <>
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
            <div className="flex flex-col">
              <Label htmlFor="workflow-email-include-variables" className="text-sm font-medium">
                {t("workspace.workflows.email_include_variables_label")}
              </Label>
              <p className="text-xs text-slate-500">
                {t("workspace.workflows.email_include_embedded_data_description")}
              </p>
            </div>
            <Switch
              id="workflow-email-include-variables"
              checked={getIncludeEmbeddedData(node.config)}
              disabled={!isEditable}
              // Saved under the new name; the deprecated one is dropped so the two never mix (ADR 0050).
              onCheckedChange={(checked) =>
                updateConfig({ includeEmbeddedData: checked, includeVariables: undefined })
              }
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
    </>
  );
};
