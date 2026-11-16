"use client";

import { LinkIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { TWorkflowSendEmailActionConfig, TWorkflowSurveyLinkEmbeddedData } from "@formbricks/workflows";
import { InspectorCard } from "@/modules/ee/workflows/components/inspector/inspector-card";
import { WorkflowVariableInput } from "@/modules/ee/workflows/components/inspector/workflow-variable-input";
import { useSurveyLinkFields } from "@/modules/ee/workflows/hooks/use-survey-link-fields";
import { useWorkflowSurveyOptions } from "@/modules/ee/workflows/hooks/use-trigger-survey-picker";
import { hasSurveyLinkToken, updateEmbeddedDataRow } from "@/modules/ee/workflows/lib/email-survey-link";
import type { TSurveyLinkField } from "@/modules/ee/workflows/lib/survey-link-fields";
import { Button } from "@/modules/ui/components/button";
import type { TEditorRecallSource } from "@/modules/ui/components/editor/components/recall-source";
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
  /** The step's Variable picker, for the Embedded Data values. */
  recallSource: TEditorRecallSource;
}

/** The fields a row's key can be: its own, and every field no other row sets yet. */
const getRowKeyOptions = (
  fields: TSurveyLinkField[],
  rows: TWorkflowSurveyLinkEmbeddedData[],
  index: number
) => fields.filter((field) => !rows.some((row, i) => i !== index && row.key === field.key));

const nextUnusedFieldKey = (
  fields: TSurveyLinkField[] | null,
  rows: TWorkflowSurveyLinkEmbeddedData[]
): string | null => fields?.find((field) => !rows.some((row) => row.key === field.key))?.key ?? null;

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
  recallSource,
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
  const isLinkInBody = hasSurveyLinkToken(config.body);
  // The linked survey's fields its link can set; null while loading or unreadable (then the key is typed).
  const fields = useSurveyLinkFields(surveyLink?.surveyId);
  // Nothing to set on a survey without such fields: the section only stays to clear rows saved earlier.
  const showEmbeddedData = fields === null || fields.length > 0 || rows.length > 0;
  const canAddRow = fields === null || nextUnusedFieldKey(fields, rows) !== null;

  return (
    <InspectorCard
      title={<Label htmlFor="workflow-email-survey-link">{t("workspace.workflows.email_survey_link")}</Label>}
      aside={
        surveyLink && isEditable ? (
          <Button type="button" variant="ghost" size="sm" className="-my-1" onClick={onRemove}>
            {t("common.remove")}
          </Button>
        ) : null
      }>
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
          {/* Picking the survey already puts the link at the end of the message; this brings it back
              once it was deleted there. */}
          {isLinkInBody ? (
            <p className="text-xs text-slate-500">{t("workspace.workflows.email_survey_link_in_message")}</p>
          ) : (
            isEditable && (
              <Button type="button" variant="secondary" size="sm" className="w-fit" onClick={onInsertLink}>
                <LinkIcon />
                {t("workspace.workflows.email_insert_survey_link")}
              </Button>
            )
          )}
          {showEmbeddedData ? (
            <div className="flex flex-col gap-2">
              <Label>{t("workspace.workflows.email_survey_link_embedded_data")}</Label>
              {rows.map((row, index) => (
                <div key={index} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    {fields ? (
                      <Select
                        value={row.key}
                        disabled={!isEditable}
                        onValueChange={(key) => changeRows(updateEmbeddedDataRow(rows, index, { key }))}>
                        <SelectTrigger
                          aria-label={t("workspace.workflows.email_survey_link_key")}
                          className="w-2/5 bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {getRowKeyOptions(fields, rows, index).map((field) => (
                            <SelectItem key={field.key} value={field.key}>
                              {field.name}
                            </SelectItem>
                          ))}
                          {fields.some((field) => field.key === row.key) ? null : (
                            // A key saved before the survey dropped the field, or set through the API.
                            <SelectItem value={row.key}>{row.key}</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    ) : (
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
                    )}
                    <WorkflowVariableInput
                      value={row.value}
                      disabled={!isEditable}
                      placeholder={t("workspace.workflows.http_request_value_placeholder")}
                      aria-label={t("workspace.workflows.email_survey_link_value")}
                      className="min-w-0 flex-1"
                      recallSource={recallSource}
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
                  {fields && row.key !== "" && !fields.some((field) => field.key === row.key) ? (
                    // The send would drop it (the link's survey doesn't take it), so say so here.
                    <p className="text-xs text-amber-700">
                      {t("workspace.workflows.email_survey_link_key_not_taken", { key: row.key })}
                    </p>
                  ) : null}
                </div>
              ))}
              {isEditable && canAddRow ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="w-fit"
                  onClick={() =>
                    // With the survey's fields known, a new row starts on the first one not set yet.
                    changeRows([...rows, { key: nextUnusedFieldKey(fields, rows) ?? "", value: "" }])
                  }>
                  <PlusIcon />
                  {t("workspace.workflows.email_survey_link_add_embedded_data")}
                </Button>
              ) : null}
              <p className="text-xs text-slate-500">
                {t("workspace.workflows.email_survey_link_embedded_data_help")}
              </p>
            </div>
          ) : null}
        </>
      ) : (
        <p className="text-xs text-slate-500">{t("workspace.workflows.email_survey_link_help")}</p>
      )}
    </InspectorCard>
  );
};
