"use client";

import { useAtomValue } from "jotai";
import { EyeOffIcon, MailIcon, TriangleAlertIcon, UserIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TWorkflowSendEmailActionNode } from "@formbricks/workflows";
import FollowUpActionMultiEmailInput from "@/modules/survey/follow-ups/components/follow-up-action-multi-email-input";
import {
  type EmailSendToOption,
  buildEmailSendToOptions,
} from "@/modules/survey/follow-ups/lib/email-send-to-options";
import { getElementIconMap } from "@/modules/survey/lib/elements";
import { Editor } from "@/modules/ui/components/editor";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { Switch } from "@/modules/ui/components/switch";
import { useWorkflowEmailAuthoringContext } from "@/modules/workflows/components/workflow-email-authoring-context";
import { workflowDefinitionAtom } from "@/modules/workflows/state/editor";

interface WorkflowEmailActionFormProps {
  node: TWorkflowSendEmailActionNode;
  isEditable: boolean;
  onChange: (next: TWorkflowSendEmailActionNode) => void;
}

// The internal "default language" slot recall/headline resolution uses when no language is selected.
const DEFAULT_LANGUAGE_CODE = "default";

const HTML_TAG_PATTERN = /<[a-z][\s\S]*>/i;

const escapeHtml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// The recall Editor loads its initial value as HTML (root can only hold block nodes). Recall-token
// bodies are already `<p>…</p>` HTML and pass through untouched; legacy plain-text bodies (e.g. the
// seed's "Hi there…") are escaped and wrapped in paragraphs so Lexical doesn't crash on a bare text
// node ("Only element or decorator nodes can be inserted to the root node").
const toEditorHtml = (body: string): string => {
  if (!body) return "";
  if (HTML_TAG_PATTERN.test(body)) return body;
  return body
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
};

export const WorkflowEmailActionForm = ({
  node,
  isEditable,
  onChange,
}: Readonly<WorkflowEmailActionFormProps>) => {
  const { t } = useTranslation();
  const authoringContext = useWorkflowEmailAuthoringContext();
  const definition = useAtomValue(workflowDefinitionAtom);
  const [firstRender, setFirstRender] = useState(true);

  const updateConfig = (next: Partial<TWorkflowSendEmailActionNode["config"]>) =>
    onChange({ ...node, config: { ...node.config, ...next } });

  // The authoring context is resolved from the survey bound at page load. If the user switched the
  // trigger survey in this session, the context is stale for the new survey — fall back to plain
  // controls (no recall / recipient options) rather than showing the wrong survey's fields.
  const triggerSurveyId = definition?.trigger.type === "trigger" ? definition.trigger.config.surveyId : null;
  const survey =
    authoringContext?.survey && authoringContext.survey.id === triggerSurveyId
      ? authoringContext.survey
      : null;

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

  const ELEMENTS_ICON_MAP = getElementIconMap(t);

  const getSelectItemIcon = (type: EmailSendToOption["type"]): React.ReactNode => {
    switch (type) {
      case "verifiedEmail":
        return <MailIcon className="size-4" />;
      case "hiddenField":
        return <EyeOffIcon className="size-4" />;
      case "user":
        return <UserIcon className="size-4" />;
      case "openTextElement":
      case "contactInfoElement":
        return (
          <div className="size-4">
            {ELEMENTS_ICON_MAP[type === "openTextElement" ? "openText" : "contactInfo"]}
          </div>
        );
    }
  };

  const renderSelectItem = (option: EmailSendToOption) => (
    <SelectItem key={option.id} value={option.id}>
      <div className="flex items-center gap-x-2">
        {getSelectItemIcon(option.type)}
        <span className="overflow-hidden text-ellipsis whitespace-nowrap">{option.label}</span>
      </div>
    </SelectItem>
  );

  const verifiedEmailOptions = emailSendToOptions.filter((option) => option.type === "verifiedEmail");
  const elementOptions = emailSendToOptions.filter(
    (option) => option.type === "openTextElement" || option.type === "contactInfoElement"
  );
  const hiddenFieldOptions = emailSendToOptions.filter((option) => option.type === "hiddenField");
  const userOptions = emailSendToOptions.filter((option) => option.type === "user");

  return (
    <div className="flex flex-col gap-4">
      {/* Recipient */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="workflow-email-to">{t("workspace.workflows.email_to_label")}</Label>
        <p className="text-xs text-slate-500">
          {t("workspace.surveys.edit.follow_ups_modal_action_to_description")}
        </p>
        {survey ? (
          emailSendToOptions.length > 0 ? (
            <Select
              value={node.config.to || undefined}
              disabled={!isEditable}
              onValueChange={(value) => updateConfig({ to: value })}>
              <SelectTrigger
                id="workflow-email-to"
                className="overflow-hidden text-ellipsis whitespace-nowrap bg-white">
                <SelectValue placeholder={t("workspace.workflows.email_to_placeholder")} />
              </SelectTrigger>
              <SelectContent>
                {verifiedEmailOptions.length > 0 || elementOptions.length > 0 ? (
                  <div className="flex flex-col">
                    <div className="flex items-center gap-x-2 p-2">
                      <p className="text-sm text-slate-500">{t("common.questions")}</p>
                    </div>
                    {verifiedEmailOptions.map(renderSelectItem)}
                    {elementOptions.map(renderSelectItem)}
                  </div>
                ) : null}
                {hiddenFieldOptions.length > 0 ? (
                  <div className="flex flex-col">
                    <div className="flex gap-x-2 p-2">
                      <p className="text-sm text-slate-500">{t("common.hidden_fields")}</p>
                    </div>
                    {hiddenFieldOptions.map(renderSelectItem)}
                  </div>
                ) : null}
                {userOptions.length > 0 ? (
                  <div className="flex flex-col">
                    <div className="flex gap-x-2 p-2">
                      <p className="text-sm text-slate-500">{t("common.members")}</p>
                    </div>
                    {userOptions.map(renderSelectItem)}
                  </div>
                ) : null}
              </SelectContent>
            </Select>
          ) : (
            <div className="flex items-start gap-2 text-yellow-600">
              <TriangleAlertIcon className="mt-0.5 size-4 min-h-4 min-w-4" aria-hidden="true" />
              <p className="text-sm">{t("workspace.surveys.edit.follow_ups_modal_action_to_warning")}</p>
            </div>
          )
        ) : (
          // No bound survey resolved (unbound trigger or survey switched this session): plain email input.
          <Input
            id="workflow-email-to"
            value={node.config.to}
            disabled={!isEditable}
            placeholder={t("workspace.workflows.email_to_placeholder")}
            onChange={(event) => updateConfig({ to: event.target.value })}
          />
        )}
        {!triggerSurveyId ? (
          <p className="text-xs text-slate-500">{t("workspace.workflows.email_to_pick_survey")}</p>
        ) : null}
      </div>

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
        <FollowUpActionMultiEmailInput
          emails={node.config.replyTo}
          setEmails={(update) => {
            const nextReplyTo = typeof update === "function" ? update(node.config.replyTo) : update;
            updateConfig({ replyTo: nextReplyTo });
          }}
        />
      </div>

      {/* Subject */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="workflow-email-subject">{t("workspace.workflows.email_subject_label")}</Label>
        <Input
          id="workflow-email-subject"
          value={node.config.subject}
          disabled={!isEditable}
          placeholder={t("workspace.workflows.email_subject_placeholder")}
          onChange={(event) => updateConfig({ subject: event.target.value })}
        />
      </div>

      {/* Body (recall editor) */}
      <div className="flex flex-col gap-2">
        <Label>{t("workspace.workflows.email_body_label")}</Label>
        {survey ? (
          <Editor
            disableLists
            excludedToolbarItems={["blockType"]}
            getText={() => toEditorHtml(node.config.body)}
            setText={(value: string) => updateConfig({ body: value })}
            firstRender={firstRender}
            setFirstRender={setFirstRender}
            editable={isEditable}
            placeholder={t("workspace.workflows.email_body_placeholder")}
            localSurvey={survey}
            elementId={node.id}
            selectedLanguageCode={DEFAULT_LANGUAGE_CODE}
          />
        ) : (
          <textarea
            id="workflow-email-body"
            value={node.config.body}
            disabled={!isEditable}
            rows={6}
            placeholder={t("workspace.workflows.email_body_placeholder")}
            className="flex w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
            onChange={(event) => updateConfig({ body: event.target.value })}
          />
        )}
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
