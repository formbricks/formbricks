"use client";

import { createId } from "@paralleldrive/cuid2";
import { Trash2Icon } from "lucide-react";
import { type JSX, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { getLanguageLabel } from "@formbricks/i18n-utils/src/utils";
import { TI18nString } from "@formbricks/types/i18n";
import { TOptionList } from "@formbricks/types/option-list";
import { TSurveyMultipleChoiceElement } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { createI18nString } from "@/lib/i18n/utils";
import {
  createOptionListAction,
  deleteOptionListAction,
  getOptionListsAction,
} from "@/modules/survey/editor/actions";
import { findElementLocation } from "@/modules/survey/editor/lib/blocks";
import { DEFAULT_OPTION_LISTS } from "@/modules/survey/editor/lib/default-option-lists";
import { findOptionUsedInLogic } from "@/modules/survey/editor/lib/utils";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";
import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { Input } from "@/modules/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";

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
  environmentId: string;
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
  environmentId,
}: BulkEditOptionsModalProps): JSX.Element => {
  const { t } = useTranslation();
  const [textareaValue, setTextareaValue] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [savedLists, setSavedLists] = useState<TOptionList[]>([]);
  const [newListName, setNewListName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

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
      setNewListName("");

      // Fetch saved option lists
      getOptionListsAction({ environmentId })
        .then((result) => {
          if (result?.data) {
            setSavedLists(result.data);
          }
        })
        .catch((error) => {
          console.error("Failed to load option lists:", error);
        });
    }
  }, [isOpen, regularChoices, selectedLanguageCode, environmentId]);

  const validateRemovedOptions = (newLabels: string[]): string | null => {
    const originalLabels = regularChoices.map((c) => c.label[selectedLanguageCode] || "");
    const missingLabels = originalLabels.filter((label) => label && !newLabels.includes(label));

    if (missingLabels.length === 0) return null;

    // Find which choices have missing labels and check if they're used in logic
    const choicesWithMissingLabels = missingLabels
      .map((label) => regularChoices.find((c) => c.label[selectedLanguageCode] === label))
      .filter((c): c is TSurveyMultipleChoiceElement["choices"][number] => c !== undefined);

    // Get all elements to find which block has the logic
    const allElements = getElementsFromBlocks(localSurvey.blocks);

    // Build detailed error info: option label -> block name where it's used
    const problematicOptions: { optionLabel: string; blockName: string }[] = [];

    for (const choice of choicesWithMissingLabels) {
      const elementIndex = findOptionUsedInLogic(localSurvey, element.id, choice.id);
      if (elementIndex !== -1) {
        const elementWithLogic = allElements[elementIndex];
        // Find which block contains this element
        const { block } = findElementLocation(localSurvey, elementWithLogic.id);
        if (block) {
          const optionLabel = choice.label[selectedLanguageCode] || "";
          problematicOptions.push({ optionLabel, blockName: block.name });
        }
      }
    }

    if (problematicOptions.length === 0) return null;

    // Format: "Option '3' is used in logic at 'Block Name'"
    const details = problematicOptions.map((opt) => `"${opt.optionLabel}" → ${opt.blockName}`).join(", ");

    return t("environments.surveys.edit.options_used_in_logic_bulk_error", {
      questionIndexes: details,
    });
  };

  const handleLoadList = (options: string[]) => {
    setTextareaValue(options.join("\n"));
    setValidationError(null);
    toast.success(t("environments.surveys.edit.list_loaded"));
  };

  const handleSaveList = async () => {
    if (!newListName.trim()) {
      toast.error(t("environments.surveys.edit.list_name") + " is required");
      return;
    }

    const currentOptions = parseUniqueLines(textareaValue);
    if (currentOptions.length === 0) {
      toast.error("Cannot save an empty list");
      return;
    }

    setIsSaving(true);
    try {
      const result = await createOptionListAction({
        environmentId,
        name: newListName.trim(),
        options: currentOptions,
      });

      if (result?.data) {
        setSavedLists([...savedLists, result.data]);
        setNewListName("");
        toast.success(t("environments.surveys.edit.list_saved_successfully"));
      }
    } catch (error) {
      toast.error("Failed to save list");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteList = async (listId: string) => {
    try {
      await deleteOptionListAction({ optionListId: listId });
      setSavedLists(savedLists.filter((list) => list.id !== listId));
      toast.success(t("environments.surveys.edit.list_deleted_successfully"));
    } catch (error) {
      toast.error("Failed to delete list");
      console.error(error);
    }
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

        <div className="space-y-4">
          {/* Load from list dropdown */}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Select
                onValueChange={(value) => {
                  const defaultList = DEFAULT_OPTION_LISTS.find((list) => list.id === value);
                  if (defaultList) {
                    handleLoadList(defaultList.options);
                    return;
                  }

                  const savedList = savedLists.find((list) => list.id === value);
                  if (savedList) {
                    handleLoadList(savedList.options);
                  }
                }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("environments.surveys.edit.load_from_list")} />
                </SelectTrigger>
                <SelectContent>
                  {DEFAULT_OPTION_LISTS.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-slate-500">
                        {t("environments.surveys.edit.defaults")}
                      </div>
                      {DEFAULT_OPTION_LISTS.map((list) => (
                        <SelectItem key={list.id} value={list.id}>
                          {list.name}
                        </SelectItem>
                      ))}
                    </>
                  )}
                  {savedLists.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-slate-500">
                        {t("environments.surveys.edit.saved_lists")}
                      </div>
                      {savedLists.map((list) => (
                        <SelectItem key={list.id} value={list.id}>
                          <div className="flex w-full items-center justify-between gap-2">
                            <span>{list.name}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-auto p-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteList(list.id);
                              }}>
                              <Trash2Icon className="h-3 w-3 text-slate-500 hover:text-red-600" />
                            </Button>
                          </div>
                        </SelectItem>
                      ))}
                    </>
                  )}
                  {DEFAULT_OPTION_LISTS.length === 0 && savedLists.length === 0 && (
                    <div className="px-2 py-4 text-center text-sm text-slate-500">No saved lists</div>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Save as list section */}
          <div className="flex items-center gap-2">
            <Input
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder={t("environments.surveys.edit.list_name")}
              className="flex-1"
            />
            <Button variant="secondary" onClick={handleSaveList} disabled={isSaving || !newListName.trim()}>
              {t("environments.surveys.edit.save_as_list")}
            </Button>
          </div>

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
