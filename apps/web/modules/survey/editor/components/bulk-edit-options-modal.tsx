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

  // Get the display name for the selected language
  const selectedLanguageName = useMemo(() => {
    if (localSurvey.languages.length <= 1) return null;

    const languageCode =
      selectedLanguageCode === "default"
        ? localSurvey.languages.find((lang) => lang.default)?.language.code
        : selectedLanguageCode;

    return languageCode ? getLanguageLabel(languageCode, locale) : null;
  }, [localSurvey.languages, selectedLanguageCode, locale]);

  // Update textarea content whenever modal opens or regularChoices change
  useEffect(() => {
    if (isOpen) {
      setTextareaValue(regularChoices.map((choice) => choice.label[selectedLanguageCode] || "").join("\n"));
      setValidationError(null);
    }
  }, [isOpen, regularChoices, selectedLanguageCode]);

  const parseTextareaContent = (content: string): string[] => {
    const lines = content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    // Remove duplicates, keeping the first occurrence
    const seen = new Set<string>();
    return lines.filter((line) => {
      if (seen.has(line)) {
        return false;
      }
      seen.add(line);
      return true;
    });
  };

  const checkRemovedOptionsLogic = (newLabels: string[]): { valid: boolean; error: string | null } => {
    // If the new array is shorter, some options were removed
    if (newLabels.length >= regularChoices.length) {
      return { valid: true, error: null };
    }

    const problematicQuestions = new Set<number>();

    // Check each removed option
    regularChoices.slice(newLabels.length).forEach((removedChoice) => {
      const questionIdx = findOptionUsedInLogic(localSurvey, element.id, removedChoice.id);
      if (questionIdx !== -1) {
        problematicQuestions.add(questionIdx + 1);
      }
    });

    if (problematicQuestions.size > 0) {
      const questionIndexes = Array.from(problematicQuestions)
        .sort((a, b) => a - b)
        .join(", ");
      return {
        valid: false,
        error: t("environments.surveys.edit.options_used_in_logic_bulk_error", {
          questionIndexes,
        }),
      };
    }

    return { valid: true, error: null };
  };

  const handleSave = () => {
    setValidationError(null);

    // Parse content and remove duplicates
    const newLabels = parseTextareaContent(textareaValue);

    // Check if removed options are used in logic
    const logicCheck = checkRemovedOptionsLogic(newLabels);
    if (!logicCheck.valid) {
      setValidationError(logicCheck.error);
      return;
    }

    // Create updated choices array
    const updatedChoices = newLabels.map((label, idx) => {
      if (idx < regularChoices.length) {
        // Update existing choice, preserving ID and updating label for selected language
        // Ensure all language codes exist in the label object to prevent validation errors
        const updatedLabel = { ...regularChoices[idx].label };

        // Fill in any missing language codes with empty strings
        surveyLanguageCodes.forEach((code) => {
          if (updatedLabel[code] === undefined) {
            updatedLabel[code] = "";
          }
        });

        // Update the selected language
        updatedLabel[selectedLanguageCode] = label;

        return {
          ...regularChoices[idx],
          label: updatedLabel as TI18nString,
        };
      } else {
        // Create new choice
        return {
          id: createId(),
          label: createI18nString(label, surveyLanguageCodes),
        };
      }
    });

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
