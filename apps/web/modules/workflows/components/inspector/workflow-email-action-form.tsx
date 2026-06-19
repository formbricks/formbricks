"use client";

import { useTranslation } from "react-i18next";
import type { TWorkflowSendEmailActionNode } from "@formbricks/workflows";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { Switch } from "@/modules/ui/components/switch";

interface WorkflowEmailActionFormProps {
  node: TWorkflowSendEmailActionNode;
  isEditable: boolean;
  onChange: (next: TWorkflowSendEmailActionNode) => void;
}

const replyToToString = (replyTo: string[]) => replyTo.join(", ");

const parseReplyTo = (input: string): string[] =>
  input
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);

export const WorkflowEmailActionForm = ({
  node,
  isEditable,
  onChange,
}: Readonly<WorkflowEmailActionFormProps>) => {
  const { t } = useTranslation();

  const updateConfig = (next: Partial<TWorkflowSendEmailActionNode["config"]>) =>
    onChange({ ...node, config: { ...node.config, ...next } });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="workflow-email-to">{t("workspace.workflows.email_to_label")}</Label>
        <Input
          id="workflow-email-to"
          value={node.config.to}
          disabled={!isEditable}
          placeholder={t("workspace.workflows.email_to_placeholder")}
          onChange={(event) => updateConfig({ to: event.target.value })}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="workflow-email-from">{t("workspace.workflows.email_from_label")}</Label>
        <Input
          id="workflow-email-from"
          type="email"
          value={node.config.from}
          disabled={!isEditable}
          placeholder={t("workspace.workflows.email_from_placeholder")}
          onChange={(event) => updateConfig({ from: event.target.value })}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="workflow-email-reply-to">{t("workspace.workflows.email_reply_to_label")}</Label>
        <Input
          id="workflow-email-reply-to"
          value={replyToToString(node.config.replyTo)}
          disabled={!isEditable}
          placeholder={t("workspace.workflows.email_reply_to_placeholder")}
          onChange={(event) => updateConfig({ replyTo: parseReplyTo(event.target.value) })}
        />
        <p className="text-xs text-slate-500">{t("workspace.workflows.email_reply_to_description")}</p>
      </div>

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

      <div className="flex flex-col gap-2">
        <Label htmlFor="workflow-email-body">{t("workspace.workflows.email_body_label")}</Label>
        <textarea
          id="workflow-email-body"
          value={node.config.body}
          disabled={!isEditable}
          rows={6}
          placeholder={t("workspace.workflows.email_body_placeholder")}
          className="flex w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
          onChange={(event) => updateConfig({ body: event.target.value })}
        />
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
