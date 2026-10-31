"use client";

import { useTranslation } from "react-i18next";
import { ImportFieldProblems } from "@/modules/survey/import/components/import-field-problems";
import type {
  TSurveyImportChoice,
  TSurveyImportMatchConflict,
} from "@/modules/survey/import/hooks/use-import-survey";
import type { TSurveyImportMatch, TSurveyImportTriggersChoice } from "@/modules/survey/import/types";
import { Alert, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { StylingTabs } from "@/modules/ui/components/styling-tabs";

type ImportMatchChoiceProps = {
  match: TSurveyImportMatch;
  /** What "Create new" would name the survey: the reviewed draft's name. */
  newSurveyName: string;
  choice: TSurveyImportChoice;
  onChoiceChange: (choice: TSurveyImportChoice) => void;
  triggersChoice: TSurveyImportTriggersChoice;
  onTriggersChoiceChange: (choice: TSurveyImportTriggersChoice) => void;
  conflict: TSurveyImportMatchConflict | null;
};

/**
 * The choice a Match offers (ENG-6851), laid out like the contacts upload's Duplicates choice: Update the
 * survey the file was exported from, or Create new. An active survey locks it on Create new, and so
 * does a file the Update would refuse, whose reasons are listed. A survey
 * that changed since the export says so, and its Update becomes "Update anyway". When the file's
 * triggers differ from the survey's, a second row picks which to keep, locked to the survey's own when
 * the file's would leave a live survey with nothing to show it.
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
}: Readonly<ImportMatchChoiceProps>) => {
  const { t } = useTranslation();
  const isLocked = conflict === "active" || conflict === "refused";
  const triggersLocked = match.triggers === "keep_only";

  const choiceDescription = () => {
    if (conflict === "refused") {
      return t("workspace.surveys.import.match.refused_description", {
        name: match.name,
        newName: newSurveyName,
      });
    }
    if (isLocked) {
      return t("workspace.surveys.import.match.active_description", {
        name: match.name,
        newName: newSurveyName,
      });
    }
    return choice === "update"
      ? t("workspace.surveys.import.match.update_description")
      : t("workspace.surveys.import.match.create_description", { newName: newSurveyName });
  };

  const triggersDescription = () => {
    if (triggersLocked) return t("workspace.surveys.import.match.triggers_locked_description");
    return triggersChoice === "file"
      ? t("workspace.surveys.import.match.triggers_file_description")
      : t("workspace.surveys.import.match.triggers_keep_description");
  };

  return (
    <section className="flex flex-col gap-3 text-sm" data-testid="survey-import-match">
      {conflict === "stale" ? (
        <Alert variant="warning" size="small" data-testid="survey-import-stale">
          <AlertTitle>{t("workspace.surveys.import.match.stale_title", { name: match.name })}</AlertTitle>
          <AlertDescription>{t("workspace.surveys.import.match.stale_description")}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-2" data-testid="survey-import-match-choice">
        <h3 className="font-medium text-slate-900">
          {t("workspace.surveys.import.match.title", { name: match.name })}
        </h3>
        <p className="text-slate-500">{t("workspace.surveys.import.match.question")}</p>
        <StylingTabs<TSurveyImportChoice>
          id="survey-import-match-choice"
          options={[
            { value: "update", label: t("workspace.surveys.import.match.update") },
            { value: "create", label: t("workspace.surveys.import.match.create_new") },
          ]}
          value={choice}
          onChange={onChoiceChange}
          disabled={isLocked}
          className="max-w-[400px]"
          tabsContainerClassName="p-1 rounded-lg"
        />
        <p className="text-xs font-medium text-slate-500">{choiceDescription()}</p>
        {conflict === "refused" ? (
          <ImportFieldProblems problems={match.updateRefusal} testId="survey-import-update-refusal" />
        ) : null}
      </div>

      {choice === "update" && match.triggers !== "same" ? (
        <div className="flex flex-col gap-2" data-testid="survey-import-triggers-choice">
          <h3 className="font-medium text-slate-900">{t("workspace.surveys.import.match.triggers_title")}</h3>
          <p className="text-slate-500">{t("workspace.surveys.import.match.triggers_question")}</p>
          <StylingTabs<TSurveyImportTriggersChoice>
            id="survey-import-triggers-choice"
            options={[
              { value: "file", label: t("workspace.surveys.import.match.triggers_file") },
              { value: "keep", label: t("workspace.surveys.import.match.triggers_keep") },
            ]}
            value={triggersLocked ? "keep" : triggersChoice}
            onChange={onTriggersChoiceChange}
            disabled={triggersLocked}
            className="max-w-[400px]"
            tabsContainerClassName="p-1 rounded-lg"
          />
          <p className="text-xs font-medium text-slate-500">{triggersDescription()}</p>
        </div>
      ) : null}
    </section>
  );
};
