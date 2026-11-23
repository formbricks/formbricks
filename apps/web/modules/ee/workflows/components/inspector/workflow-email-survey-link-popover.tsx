"use client";

import { ClipboardCheckIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { TWorkflowSurveyLink } from "@formbricks/workflows";
import { WorkflowVariableInput } from "@/modules/ee/workflows/components/inspector/workflow-variable-input";
import { useSurveyLinkFields } from "@/modules/ee/workflows/hooks/use-survey-link-fields";
import {
  getSurveyLinkMappingRows,
  setEmbeddedDataValue,
  suggestVariableForField,
  toVariableToken,
} from "@/modules/ee/workflows/lib/email-survey-link";
import type { TWorkflowVariableOption } from "@/modules/ee/workflows/lib/variable-picker";
import { Button } from "@/modules/ui/components/button";
import type { TEditorRecallSource } from "@/modules/ui/components/editor/components/recall-source";
import { Label } from "@/modules/ui/components/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/modules/ui/components/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";

export interface TWorkflowLinkSurveyOption {
  id: string;
  name: string;
}

interface WorkflowEmailSurveyLinkPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  surveyLink: TWorkflowSurveyLink | undefined;
  /** The message already holds the link's chip: the popover edits it instead of inserting another. */
  isLinkInBody: boolean;
  linkSurveys: readonly TWorkflowLinkSurveyOption[];
  disabled: boolean;
  /** The step's Variable picker, for the Embedded Data values. */
  recallSource: TEditorRecallSource;
  /** Every Variable the step can use, to suggest one per field. */
  variableOptions: readonly TWorkflowVariableOption[];
  /** Insert link, or Save: the caller stores the link and, when inserting, places the chip. */
  onSave: (surveyLink: TWorkflowSurveyLink) => void;
  onRemove: () => void;
}

/**
 * The message toolbar's "Survey link" (review point 13): a button next to @ that opens the popover
 * to pick a link survey and pass run data to it, then puts the link at the cursor. The chip's Edit
 * reopens it. One link per email: with the chip in the message, the popover edits that link.
 */
export const WorkflowEmailSurveyLinkPopover = ({
  open,
  onOpenChange,
  disabled,
  ...formProps
}: Readonly<WorkflowEmailSurveyLinkPopoverProps>) => {
  const { t } = useTranslation();
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                className="text-slate-600 hover:bg-slate-100 hover:text-slate-900">
                <ClipboardCheckIcon />
                {t("workspace.workflows.email_survey_link_button")}
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t("workspace.workflows.email_survey_link_tooltip")}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent align="end" className="w-96">
        {/* The content unmounts when closed, so each opening starts from the stored link. */}
        <SurveyLinkForm {...formProps} onCancel={() => onOpenChange(false)} />
      </PopoverContent>
    </Popover>
  );
};

const SurveyLinkForm = ({
  surveyLink,
  isLinkInBody,
  linkSurveys,
  recallSource,
  variableOptions,
  onSave,
  onRemove,
  onCancel,
}: Readonly<
  Omit<WorkflowEmailSurveyLinkPopoverProps, "open" | "onOpenChange" | "disabled"> & { onCancel: () => void }
>) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<TWorkflowSurveyLink>(surveyLink ?? { surveyId: "", embeddedData: [] });
  const { fields, isLoading } = useSurveyLinkFields(draft.surveyId || undefined);
  const rows = getSurveyLinkMappingRows(fields, draft.embeddedData);
  const setValue = (key: string, value: string) =>
    setDraft((current) => ({
      ...current,
      embeddedData: setEmbeddedDataValue(current.embeddedData, key, value),
    }));

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (draft.surveyId) onSave(draft);
      }}>
      <p className="text-sm font-semibold text-slate-900">
        {isLinkInBody
          ? t("workspace.workflows.email_survey_link_edit_title")
          : t("workspace.workflows.email_survey_link_insert_title")}
      </p>

      <div className="flex flex-col gap-2">
        <Label htmlFor="workflow-email-survey-link-survey">{t("common.survey")}</Label>
        <Select
          value={draft.surveyId}
          onValueChange={(surveyId) => setDraft((current) => ({ ...current, surveyId }))}>
          <SelectTrigger id="workflow-email-survey-link-survey" className="bg-white">
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
      </div>

      {draft.surveyId ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-0.5">
            <Label>
              {t("workspace.workflows.email_survey_link_pass_data")}{" "}
              <span className="font-normal text-slate-500">· {t("common.optional")}</span>
            </Label>
            <p className="text-xs text-slate-500">
              {t("workspace.workflows.email_survey_link_pass_data_help")}
            </p>
          </div>
          {isLoading ? <p className="text-xs text-slate-500">{t("common.loading")}</p> : null}
          {!isLoading && rows.length === 0 ? (
            <p className="text-xs text-slate-500">{t("workspace.workflows.email_survey_link_no_fields")}</p>
          ) : null}
          {rows.map((row) => {
            const suggestion = row.value === "" ? suggestVariableForField(row, variableOptions) : null;
            return (
              <div key={row.key} className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2/5 truncate rounded-md bg-slate-100 px-2 py-1 font-mono text-xs text-slate-700"
                    title={row.key}>
                    {row.name}
                  </span>
                  <span aria-hidden="true" className="text-slate-400">
                    ←
                  </span>
                  <WorkflowVariableInput
                    value={row.value}
                    placeholder={t("workspace.workflows.email_survey_link_value_placeholder")}
                    aria-label={t("workspace.workflows.email_survey_link_value", { field: row.name })}
                    className="min-w-0 flex-1"
                    recallSource={recallSource}
                    onChange={(value) => setValue(row.key, value)}
                  />
                  {row.isTaken ? null : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t("common.remove")}
                      onClick={() => setValue(row.key, "")}>
                      <Trash2Icon />
                    </Button>
                  )}
                </div>
                {row.isTaken ? null : (
                  // The send would drop it (the link's survey doesn't take it), so say so here.
                  <p className="text-xs text-amber-700">
                    {t("workspace.workflows.email_survey_link_key_not_taken", { key: row.key })}
                  </p>
                )}
                {suggestion ? (
                  <button
                    type="button"
                    className="ml-[calc(40%+2rem)] w-fit text-left text-xs text-slate-500 hover:text-slate-900"
                    onClick={() => setValue(row.key, toVariableToken(suggestion.path))}>
                    {t("workspace.workflows.email_survey_link_use_suggestion", {
                      variable: suggestion.label,
                    })}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        {surveyLink ? (
          <Button type="button" variant="ghost" size="sm" className="text-red-600" onClick={onRemove}>
            {t("workspace.workflows.email_survey_link_remove")}
          </Button>
        ) : null}
        <Button type="button" variant="secondary" size="sm" className="ml-auto" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" size="sm" disabled={!draft.surveyId}>
          {isLinkInBody ? t("common.save") : t("workspace.workflows.email_survey_link_insert")}
        </Button>
      </div>
    </form>
  );
};
