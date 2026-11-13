"use client";

import { LinkIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { TWorkflowSendEmailActionConfig } from "@formbricks/workflows";
import { WorkflowVariableInput } from "@/modules/ee/workflows/components/inspector/workflow-variable-input";
import type { TWorkflowVariableRequest } from "@/modules/ee/workflows/components/variable-picker/use-workflow-variable-picker";
import { useWorkflowSurveyOptions } from "@/modules/ee/workflows/hooks/use-trigger-survey-picker";
import { updateEmbeddedDataRow } from "@/modules/ee/workflows/lib/email-survey-link";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";

interface WorkflowEmailSurveyLinkSectionProps {
  config: TWorkflowSendEmailActionConfig;
  isEditable: boolean;
  /** Picks the link survey (and places the link in the body). */
  onPickSurvey: (surveyId: string) => void;
  onRemove: () => void;
  onInsertLink: () => void;
  onChangeEmbeddedData: (
    embeddedData: NonNullable<TWorkflowSendEmailActionConfig["surveyLink"]>["embeddedData"]
  ) => void;
  requestVariable: (request: TWorkflowVariableRequest) => void;
}

/**
 * "Insert survey link" (ENG-7180, mock screen 4): a link survey in this workspace and the Embedded
 * Data put on its link. Values may use Variables — the one place a fixed-body email may — so the
 * answer is tied to the event that started the run.
 */
export const WorkflowEmailSurveyLinkSection = ({
  config,
  isEditable,
  onPickSurvey,
  onRemove,
  onInsertLink,
  onChangeEmbeddedData,
  requestVariable,
}: Readonly<WorkflowEmailSurveyLinkSectionProps>) => {
  const { t } = useTranslation();
  const params = useParams<{ workspaceId: string }>();
  const surveyOptions = useWorkflowSurveyOptions(params?.workspaceId ?? "");
  const linkSurveys = surveyOptions.options.filter((survey) => survey.type === "link");
  const surveyLink = config.surveyLink;
  // Rows live here while the panel is open: a row whose key is still blank can't be saved (the key is
  // required), so only rows with a key are written to the step.
  const [rows, setRows] = useState(surveyLink?.embeddedData ?? []);
  const changeRows = (next: typeof rows) => {
    setRows(next);
    onChangeEmbeddedData(next.filter((row) => row.key.trim() !== ""));
  };

  return (
    <section className="flex flex-col gap-3 rounded-md border border-slate-200 p-3">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="workflow-email-survey-link">{t("workspace.workflows.email_survey_link")}</Label>
        {surveyLink && isEditable ? (
          <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
            {t("common.remove")}
          </Button>
        ) : null}
      </div>
      <Select value={surveyLink?.surveyId} disabled={!isEditable} onValueChange={onPickSurvey}>
        <SelectTrigger id="workflow-email-survey-link" className="bg-white">
          <SelectValue placeholder={t("workspace.workflows.email_survey_link_placeholder")} />
        </SelectTrigger>
        <SelectContent>
          {linkSurveys.length === 0 ? (
            <p className="p-2 text-sm text-slate-500">{t("workspace.workflows.email_survey_link_none")}</p>
          ) : (
            linkSurveys.map((survey) => (
              <SelectItem key={survey.id} value={survey.id}>
                {survey.name}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
      {surveyLink ? (
        <>
          {isEditable ? (
            <Button type="button" variant="secondary" size="sm" className="w-fit" onClick={onInsertLink}>
              <LinkIcon />
              {t("workspace.workflows.email_insert_survey_link")}
            </Button>
          ) : null}
          <div className="flex flex-col gap-2">
            <Label>{t("workspace.workflows.email_survey_link_embedded_data")}</Label>
            {rows.map((row, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  value={row.key}
                  disabled={!isEditable}
                  placeholder={t("workspace.workflows.email_survey_link_key_placeholder")}
                  aria-label={t("workspace.workflows.email_survey_link_key")}
                  className="w-2/5"
                  onChange={(event) =>
                    changeRows(updateEmbeddedDataRow(rows, index, { key: event.target.value }))
                  }
                />
                <WorkflowVariableInput
                  value={row.value}
                  disabled={!isEditable}
                  placeholder={t("workspace.workflows.http_request_value_placeholder")}
                  aria-label={t("workspace.workflows.email_survey_link_value")}
                  className="min-w-0 flex-1"
                  requestVariable={requestVariable}
                  onChange={(value) => changeRows(updateEmbeddedDataRow(rows, index, { value }))}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={!isEditable}
                  aria-label={t("workspace.workflows.http_request_remove_row")}
                  onClick={() => changeRows(rows.filter((_, i) => i !== index))}>
                  <Trash2Icon />
                </Button>
              </div>
            ))}
            {isEditable ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-fit"
                onClick={() => changeRows([...rows, { key: "", value: "" }])}>
                <PlusIcon />
                {t("workspace.workflows.email_survey_link_add_embedded_data")}
              </Button>
            ) : null}
            <p className="text-xs text-slate-500">
              {t("workspace.workflows.email_survey_link_embedded_data_help")}
            </p>
          </div>
        </>
      ) : (
        <p className="text-xs text-slate-500">{t("workspace.workflows.email_survey_link_help")}</p>
      )}
    </section>
  );
};
