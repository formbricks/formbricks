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
  getTriggerSurveyId,
  isVariableEmailRecipient,
} from "@formbricks/workflows";
import { InspectorCard } from "@/modules/ee/workflows/components/inspector/inspector-card";
import { useWorkflowEmailSurveyLink } from "@/modules/ee/workflows/components/inspector/use-workflow-email-survey-link";
import { WorkflowEmailRecipientField } from "@/modules/ee/workflows/components/inspector/workflow-email-recipient-field";
import { WorkflowEmailResponseDataFields } from "@/modules/ee/workflows/components/inspector/workflow-email-response-data-fields";
import {
  WorkflowFieldError,
  WorkflowFieldLabel,
} from "@/modules/ee/workflows/components/inspector/workflow-field";
import { WorkflowStepNameField } from "@/modules/ee/workflows/components/inspector/workflow-step-name-field";
import { useWorkflowVariablePicker } from "@/modules/ee/workflows/components/variable-picker/use-workflow-variable-picker";
import { useWorkflowEmailAuthoringContext } from "@/modules/ee/workflows/components/workflow-email-authoring-context";
import { useWorkflowNodeFieldFocus } from "@/modules/ee/workflows/hooks/use-workflow-node-field-focus";
import { resolveBoundTriggerSurvey } from "@/modules/ee/workflows/lib/bound-survey";
import {
  fromRecipientSelectValue,
  getRecipientVariableOptions,
  toRecipientSelectValue,
} from "@/modules/ee/workflows/lib/email-recipient";
import { followSurveyLinkChip, hasUnplacedSurveyLink } from "@/modules/ee/workflows/lib/email-survey-link";
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
import { Button } from "@/modules/ui/components/button";
import { Editor } from "@/modules/ui/components/editor";
import {
  type TEditorRecallSource,
  createSurveyRecallSource,
} from "@/modules/ui/components/editor/components/recall-source";
import type { TEditorTokenChip } from "@/modules/ui/components/editor/lib/token-chips";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";

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
  // Bumped to re-seed the body editor when the body changes outside it.
  const [bodyEditorKey, setBodyEditorKey] = useState(0);
  // The body the editor shows. One that differs came from outside it (Undo, Redo, the survey link's
  // Remove), and the editor only reads its text when seeded, so it is re-seeded to show it.
  const [editorBody, setEditorBody] = useState(node.config.body);
  if (node.config.body !== editorBody) {
    setEditorBody(node.config.body);
    setFirstRender(true);
    setBodyEditorKey((key) => key + 1);
  }

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

  // Two writes can land before the next render: Insert link stores the link, then the editor reports
  // the body with its chip. Each builds on the one before, not on this render's `node`.
  const latestNodeRef = useRef(node);
  useEffect(() => {
    latestNodeRef.current = node;
  }, [node]);
  const updateConfig = (next: Partial<TWorkflowSendEmailActionNode["config"]>) => {
    const latest = latestNodeRef.current;
    latestNodeRef.current = { ...latest, config: { ...latest.config, ...next } };
    onChange(latestNodeRef.current);
  };

  // The editor reports its text on every update: typing, but also its seed and a selection change.
  // What it reports is already on screen, so it never re-seeds the editor.
  const updateBody = (nextBody: string) => {
    // A read-only step keeps its body. Taking the editor's spelling of it as shown would re-seed the
    // editor on the next render, which reports again, without end.
    if (!isEditable) return;
    setEditorBody(nextBody);
    const latest = latestNodeRef.current.config;
    const patch = followSurveyLinkChip(latest, nextBody);
    // Nothing changed (the seed after Undo, a selection change): writing would record an edit and
    // clear Redo.
    if (patch.body === latest.body && !("surveyLink" in patch)) return;
    updateConfig(patch);
  };

  const invalidFields = new Set(
    getBlankSendEmailContentFields(node.config).filter((field) => touchedFields[field])
  );
  // A blank body says so first; a survey link the body doesn't place is the other way it fails.
  let bodyError: string | null = null;
  if (invalidFields.has("body")) bodyError = t("workspace.workflows.email_body_required");
  else if (hasUnplacedSurveyLink(node.config)) {
    bodyError = t("workspace.workflows.validation_problem_survey_link_not_placed");
  }

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

  // A body written from outside the editor; the editor re-seeds once it differs from what it shows.
  const replaceBody = (next: Partial<TWorkflowSendEmailActionNode["config"]>) => updateConfig(next);
  const surveyLinkControls = useWorkflowEmailSurveyLink({
    config: node.config,
    isEditable,
    onChangeSurveyLink: (surveyLink) => updateConfig({ surveyLink }),
    onReplaceBody: replaceBody,
    recallSource: variablePicker.recallSource,
    variableGroups: variablePicker.groups,
  });

  // `#survey-link#` shows as a chip with the survey's name and is stored as the bare token.
  const bodyTokenChips: TEditorTokenChip[] = useMemo(
    () => [
      {
        token: WORKFLOW_SURVEY_LINK_TOKEN,
        label: t("workspace.workflows.email_survey_link_chip"),
        description: t("workspace.workflows.email_survey_link_chip_help"),
      },
    ],
    [t]
  );

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

  const isVariableRecipient = isVariableEmailRecipient(node.config.to);

  return (
    <div className="flex flex-col gap-3">
      <WorkflowStepNameField node={node} isEditable={isEditable} onChange={onChange} />
      {/* Who gets it and from whom, then what it says: one card per question. The rule for a payload
          recipient is the footer of the card it applies to. */}
      <InspectorCard
        title={t("workspace.workflows.email_addresses_card")}
        footer={
          isVariableRecipient ? t("workspace.workflows.email_variable_recipient_fixed_body") : undefined
        }>
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
      </InspectorCard>

      <InspectorCard title={t("workspace.workflows.email_message_card")}>
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
          <WorkflowFieldLabel id="workflow-email-body-label" isRequired isInvalid={bodyError !== null}>
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
            setText={updateBody}
            // The editor is the authority on its own emptiness: its serialized value keeps the
            // enclosing `<p>` even when blank, so "had content at some point" is the only reliable
            // signal that the user has engaged with this field.
            onEmptyChange={handleBodyEmptyChange}
            isInvalid={bodyError !== null}
            ariaDescribedBy={bodyError ? "workflow-email-body-error" : undefined}
            firstRender={firstRender}
            setFirstRender={setFirstRender}
            editable={isEditable}
            placeholder={t("workspace.workflows.email_body_placeholder")}
            recallSource={bodyRecallSource}
            tokenChips={bodyTokenChips}
            renderTokenChip={surveyLinkControls.renderTokenChip}
            renderToolbarExtras={surveyLinkControls.renderToolbarExtras}
          />
          {bodyError ? (
            <WorkflowFieldError id="workflow-email-body-error">{bodyError}</WorkflowFieldError>
          ) : null}
        </div>
      </InspectorCard>

      {/* A Webhook run has no response to attach. */}
      {isWebhookTrigger ? null : (
        <WorkflowEmailResponseDataFields node={node} isEditable={isEditable} updateConfig={updateConfig} />
      )}
    </div>
  );
};
