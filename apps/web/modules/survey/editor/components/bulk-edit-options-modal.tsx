"use client";

import { createId } from "@paralleldrive/cuid2";
import { type JSX, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { getLanguageLabel } from "@formbricks/i18n-utils/src/utils";
import { TI18nString } from "@formbricks/types/i18n";
import { TSurveyMultipleChoiceElement } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { createI18nString } from "@/lib/i18n/utils";
import { findOptionUsedInLogic } from "@/modules/survey/editor/lib/utils";
import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";

interface BulkEditOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  regularChoices: TSurveyMultipleChoiceElement["choices"];
  onSave: (updatedChoices: TSurveyMultipleChoiceElement["choices"]) => void;
  element: TSurveyMultipleChoiceElement;
  localSurvey: TSurvey;
  selectedLanguageCode: string;
  surveyLanguageCodes: string[];
  locale: TUserLocale;
}

const parseUniqueLines = (content: string): string[] => {
  return [
    ...new Set(
      content
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
    ),
  ];
};

const updateChoiceLabel = (
  choice: TSurveyMultipleChoiceElement["choices"][number],
  newLabel: string,
  selectedLangCode: string,
  allLangCodes: string[]
): TSurveyMultipleChoiceElement["choices"][number] => {
  const label = Object.fromEntries([
    ...allLangCodes.map((code) => [code, choice.label[code] ?? ""]),
    [selectedLangCode, newLabel],
  ]) as TI18nString;

  return { ...choice, label };
};

export const BulkEditOptionsModal = ({
  isOpen,
  onClose,
  regularChoices,
  onSave,
  element,
  localSurvey,
  selectedLanguageCode,
  surveyLanguageCodes,
  locale,
}: BulkEditOptionsModalProps): JSX.Element => {
  const { t } = useTranslation();
  const [textareaValue, setTextareaValue] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const selectedLanguageName = useMemo(() => {
    if (localSurvey.languages.length <= 1) return null;
    const code =
      selectedLanguageCode === "default"
        ? localSurvey.languages.find((lang) => lang.default)?.language.code
        : selectedLanguageCode;
    return code ? getLanguageLabel(code, locale) : null;
  }, [localSurvey.languages, selectedLanguageCode, locale]);

  useEffect(() => {
    if (isOpen) {
      setTextareaValue(regularChoices.map((c) => c.label[selectedLanguageCode] || "").join("\n"));
      setValidationError(null);
    }
  }, [isOpen, regularChoices, selectedLanguageCode]);

  const validateRemovedOptions = (newLabels: string[]): string | null => {
    if (newLabels.length >= regularChoices.length) return null;

    const problematicQuestions = regularChoices
      .slice(newLabels.length)
      .map((choice) => findOptionUsedInLogic(localSurvey, element.id, choice.id))
      .filter((idx) => idx !== -1)
      .map((idx) => idx + 1);

    if (problematicQuestions.length === 0) return null;

    return t("environments.surveys.edit.options_used_in_logic_bulk_error", {
      questionIndexes: [...new Set(problematicQuestions)].sort((a, b) => a - b).join(", "),
    });
  };

  const handleSave = () => {
    const newLabels = parseUniqueLines(textareaValue);
    const error = validateRemovedOptions(newLabels);

    if (error) {
      setValidationError(error);
      return;
    }

    const updatedChoices = newLabels.map((label, idx) =>
      idx < regularChoices.length
        ? updateChoiceLabel(regularChoices[idx], label, selectedLanguageCode, surveyLanguageCodes)
        : { id: createId(), label: createI18nString(label, surveyLanguageCodes) }
    );

    onSave(updatedChoices);
    onClose();
    toast.success(t("environments.surveys.edit.changes_saved"));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl space-y-4">
        <DialogHeader>
          <DialogTitle>
            {selectedLanguageName
              ? t("environments.surveys.edit.bulk_edit_options_for", { language: selectedLanguageName })
              : t("environments.surveys.edit.bulk_edit_options")}
          </DialogTitle>
          <DialogDescription>{t("environments.surveys.edit.bulk_edit_description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <textarea
            value={textareaValue}
            onChange={(e) => {
              setTextareaValue(e.target.value);
              setValidationError(null);
            }}
            onKeyDown={(e) => {
              if (e.shiftKey && e.key === "Enter") {
                e.preventDefault();
                handleSave();
              }
            }}
            rows={15}
            className="focus:border-brand w-full rounded-md border border-slate-300 bg-white p-3 font-mono text-sm focus:outline-none"
            placeholder={t("environments.surveys.edit.bulk_edit_description")}
          />
          {validationError && <div className="text-sm text-red-600">{validationError}</div>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSave}>{t("environments.surveys.edit.update_options")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
