"use client";

import type { ReactNode } from "react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { ImportFieldProblems } from "@/modules/survey/import/components/import-field-problems";
import type {
  TSurveyImportChoice,
  TSurveyImportMatchConflict,
} from "@/modules/survey/import/hooks/use-import-survey";
import type { TSurveyImportMatch, TSurveyImportTriggersChoice } from "@/modules/survey/import/types";
import { Checkbox } from "@/modules/ui/components/checkbox";
import { RadioGroup, RadioGroupItem } from "@/modules/ui/components/radio-group";

type ImportMatchChoiceProps = {
  match: TSurveyImportMatch;
  /** What "Create a new survey" would name the survey: the reviewed draft's name. */
  newSurveyName: string;
  choice: TSurveyImportChoice;
  onChoiceChange: (choice: TSurveyImportChoice) => void;
  triggersChoice: TSurveyImportTriggersChoice;
  onTriggersChoiceChange: (choice: TSurveyImportTriggersChoice) => void;
  conflict: TSurveyImportMatchConflict | null;
  /**
   * The import was started from the survey's own menu (ENG-6809): the Match is that survey, not one the
   * file names, so the choice is not introduced as "exported from".
   */
  isIntoSurvey?: boolean;
  /**
   * The file is the survey's Excel export (ENG-6809), whose Update edits texts and adds what the sheet
   * adds, rather than replacing the survey's content.
   */
  isSheet?: boolean;
};

/** One option of the choice: a card holding its radio, its title, what it does, and anything it adds. */
const ChoiceCard = ({
  value,
  title,
  description,
  isSelected,
  disabled = false,
  describedBy,
  testId,
  children,
}: Readonly<{
  value: TSurveyImportChoice;
  title: string;
  description: string;
  isSelected: boolean;
  disabled?: boolean;
  /** More ids that describe the radio, after its description: a notice in the card. */
  describedBy?: string;
  testId: string;
  children?: ReactNode;
}>) => {
  const id = useId();
  return (
    <div
      data-testid={testId}
      className={cn(
        "flex flex-col gap-2 rounded-lg border p-3 transition-colors",
        isSelected ? "border-slate-400 bg-slate-50" : "border-slate-200 bg-white"
      )}>
      <div className="flex items-start gap-3">
        <RadioGroupItem
          id={id}
          value={value}
          disabled={disabled}
          aria-describedby={[`${id}-description`, describedBy].filter(Boolean).join(" ")}
          className="mt-0.5 shrink-0"
        />
        {/* The title alone names the radio; what it does is its description, read after it. */}
        <div className="min-w-0 flex-1 space-y-0.5">
          <label
            htmlFor={id}
            className={cn(
              "block truncate text-sm font-medium",
              // Only the radio and its title dim: the text saying why it is locked stays readable.
              disabled ? "text-slate-500" : "cursor-pointer text-slate-800"
            )}>
            {title}
          </label>
          <p id={`${id}-description`} className="text-xs text-slate-500">
            {description}
          </p>
        </div>
      </div>
      {children ? <div className="pl-7">{children}</div> : null}
    </div>
  );
};

/**
 * The choice a Match offers (ENG-6851): Update the survey the file was exported from, or create a new
 * one — one radio group of two cards, each saying what it does. An active survey locks it on Create, and
 * so does a file the Update would refuse, whose reasons are listed in the Update card. A survey that
 * changed since the export says so there too, and the primary button becomes "Update anyway". When the
 * file's triggers differ from the survey's, a checkbox in the Update card picks the file's, locked off
 * when they would leave a live survey with nothing to show it.
 *
 * Survey names come from the user's data and are rendered as text only.
 */
export const ImportMatchChoice = ({
  match,
  newSurveyName,
  choice,
  onChoiceChange,
  triggersChoice,
  onTriggersChoiceChange,
  conflict,
  isIntoSurvey = false,
  isSheet = false,
}: Readonly<ImportMatchChoiceProps>) => {
  const { t } = useTranslation();
  const legendId = useId();
  const triggersId = useId();
  const staleId = useId();
  const staleNotice = t("workspace.surveys.import.match.stale_line");
  const isLocked = conflict === "active" || conflict === "refused";
  const triggersLocked = match.triggers === "keep_only";

  const updateDescription = () => {
    if (conflict === "refused") {
      return t("workspace.surveys.import.match.refused_description", {
        name: match.name,
        newName: newSurveyName,
      });
    }
    if (conflict === "active") {
      return t("workspace.surveys.import.match.active_description", {
        name: match.name,
        newName: newSurveyName,
      });
    }
    return isSheet
      ? t("workspace.surveys.import.match.update_sheet_description")
      : t("workspace.surveys.import.match.update_description");
  };

  return (
    <section className="flex flex-col gap-2 text-sm" data-testid="survey-import-match">
      <p id={legendId} className="text-slate-700">
        {isIntoSurvey
          ? t("workspace.surveys.import.match.into_survey_legend")
          : t("workspace.surveys.import.match.exported_from", { name: match.name })}
      </p>
      {/* Read out when an Update answers that the survey changed and the choice moves to Create: the
          region is there from the start, so screen readers announce what is put in it. */}
      <output className="sr-only">{conflict === "stale" ? staleNotice : ""}</output>
      <RadioGroup
        className="gap-y-2"
        value={choice}
        onValueChange={(value) => onChoiceChange(value as TSurveyImportChoice)}
        aria-labelledby={legendId}
        data-testid="survey-import-match-choice">
        <ChoiceCard
          value="update"
          title={t("workspace.surveys.import.match.update_named", { name: match.name })}
          description={updateDescription()}
          isSelected={choice === "update"}
          disabled={isLocked}
          describedBy={conflict === "stale" ? staleId : undefined}
          testId="survey-import-match-update">
          {conflict === "refused" ? (
            <ImportFieldProblems problems={match.updateRefusal} testId="survey-import-update-refusal" />
          ) : null}
          {conflict === "stale" ? (
            <p id={staleId} className="text-xs font-medium text-amber-700" data-testid="survey-import-stale">
              {staleNotice}
            </p>
          ) : null}
          {choice === "update" && match.triggers !== "same" ? (
            <div className="flex items-start gap-2" data-testid="survey-import-triggers-choice">
              <Checkbox
                id={triggersId}
                className="mt-0.5 size-4"
                checked={!triggersLocked && triggersChoice === "file"}
                disabled={triggersLocked}
                aria-describedby={`${triggersId}-help`}
                onCheckedChange={(checked) => onTriggersChoiceChange(checked === true ? "file" : "keep")}
              />
              <div className="space-y-0.5">
                <label
                  htmlFor={triggersId}
                  className={cn(
                    "block text-xs font-medium text-slate-700",
                    !triggersLocked && "cursor-pointer"
                  )}>
                  {t("workspace.surveys.import.match.triggers_use_file")}
                </label>
                <p id={`${triggersId}-help`} className="text-xs text-slate-500">
                  {triggersLocked
                    ? t("workspace.surveys.import.match.triggers_locked_description")
                    : t("workspace.surveys.import.match.triggers_differ")}
                </p>
              </div>
            </div>
          ) : null}
        </ChoiceCard>
        <ChoiceCard
          value="create"
          title={t("workspace.surveys.import.match.create_new_survey")}
          description={t("workspace.surveys.import.match.create_description", { newName: newSurveyName })}
          isSelected={choice === "create"}
          testId="survey-import-match-create"
        />
      </RadioGroup>
    </section>
  );
};
