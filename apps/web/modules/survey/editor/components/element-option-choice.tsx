"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon, PlusIcon, TrashIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  TSurveyElement,
  TSurveyElementChoice,
  TSurveyMultipleChoiceElement,
  TSurveyRankingElement,
} from "@formbricks/types/surveys/elements";
import { TSurvey, TSurveyLanguage } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { cn } from "@/lib/cn";
import { createI18nString } from "@/lib/i18n/utils";
import { ElementFormInput } from "@/modules/survey/components/element-form-input";
import { CopyIdButton } from "@/modules/survey/editor/components/copy-id-button";
import { PublishedLockNotice } from "@/modules/survey/editor/components/published-lock-notice";
import { TElementLock } from "@/modules/survey/editor/lib/published-lock";
import { Button } from "@/modules/ui/components/button";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";
import { isLabelValidForAllLanguages } from "../lib/validation";

interface ChoiceProps {
  choice: TSurveyElementChoice;
  choiceIdx: number;
  elementIdx: number;
  updateChoice: (choiceIdx: number, updatedAttributes: Partial<TSurveyElementChoice>) => void;
  deleteChoice: (choiceIdx: number) => void;
  addChoice: (choiceIdx: number) => void;
  isInvalid: boolean;
  localSurvey: TSurvey;
  surveyLanguages: TSurveyLanguage[];
  element: TSurveyMultipleChoiceElement | TSurveyRankingElement;
  updateElement: (elementIdx: number, updatedAttributes: Partial<TSurveyElement>) => void;
  surveyLanguageCodes: string[];
  locale: TUserLocale;
  isStorageConfigured: boolean;
  /** What the published lock leaves open for this question (ENG-6790). */
  lock: TElementLock;
}

export const ElementOptionChoice = ({
  addChoice,
  choice,
  choiceIdx,
  deleteChoice,
  isInvalid,
  localSurvey,
  elementIdx,
  surveyLanguages,
  updateChoice,
  element,
  surveyLanguageCodes,
  updateElement,
  locale,
  isStorageConfigured,
  lock,
}: ChoiceProps) => {
  const { t } = useTranslation();
  const isSpecialChoice = choice.id === "other" || choice.id === "none";
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: choice.id,
    disabled: isSpecialChoice,
  });

  const style = {
    transition: transition ?? "transform 100ms ease",
    transform: CSS.Translate.toString(transform),
  };

  const focusChoiceInput = (targetIdx: number) => {
    const input = document.querySelector(`input[id="choice-${targetIdx}"]`) as HTMLInputElement;
    input?.focus();
  };

  const addChoiceAndFocus = (idx: number) => {
    addChoice(idx);
    // Wait for DOM update before focusing the new input
    setTimeout(() => focusChoiceInput(idx + 1), 0);
  };

  const getPlaceholder = () => {
    if (choice.id === "other") return t("common.other");
    if (choice.id === "none") return t("common.none_of_the_above");
    return t("workspace.surveys.edit.option_idx", { choiceIndex: choiceIdx + 1 });
  };

  const isTextLocked = lock.isOptionTextLocked("choices", choice.id, "default");
  const isDeleteLocked = lock.isOptionLocked("choices", choice.id);

  const normalChoice = element.choices?.filter((c) => c.id !== "other" && c.id !== "none") || [];

  return (
    <div className="flex w-full gap-2" ref={setNodeRef} style={style}>
      {/* drag handle */}
      <div className={cn(isSpecialChoice && "invisible")} {...listeners} {...attributes}>
        <GripVerticalIcon className="size-4 cursor-move text-slate-400" />
      </div>

      <div className="flex w-full gap-x-2">
        <ElementFormInput
          key={choice.id}
          id={`choice-${choiceIdx}`}
          placeholder={getPlaceholder()}
          label={""}
          localSurvey={localSurvey}
          elementIdx={elementIdx}
          value={choice.label}
          updateChoice={updateChoice}
          isInvalid={
            isInvalid && !isLabelValidForAllLanguages(element.choices?.[choiceIdx]?.label, surveyLanguages)
          }
          className={`${isSpecialChoice ? "border border-dashed" : ""} mt-0`}
          locale={locale}
          isStorageConfigured={isStorageConfigured}
          disabled={isTextLocked}
          onKeyDown={(e) => {
            if (e.key === "Enter" && choice.id !== "other") {
              e.preventDefault();
              const lastChoiceIdx = element.choices?.findLastIndex((c) => c.id !== "other") ?? -1;

              if (choiceIdx === lastChoiceIdx) {
                addChoiceAndFocus(choiceIdx);
              } else {
                focusChoiceInput(choiceIdx + 1);
              }
            }

            if (e.key === "ArrowDown") {
              e.preventDefault();
              if (choiceIdx + 1 < (element.choices?.length ?? 0)) {
                focusChoiceInput(choiceIdx + 1);
              }
            }

            if (e.key === "ArrowUp") {
              e.preventDefault();
              if (choiceIdx > 0) {
                focusChoiceInput(choiceIdx - 1);
              }
            }
          }}
        />
        {choice.id === "other" && (
          <ElementFormInput
            id="otherOptionPlaceholder"
            localSurvey={localSurvey}
            placeholder={t("workspace.surveys.edit.please_specify")}
            label={""}
            elementIdx={elementIdx}
            value={
              element.otherOptionPlaceholder ??
              createI18nString(t("workspace.surveys.edit.please_specify"), surveyLanguageCodes)
            }
            updateElement={updateElement}
            isInvalid={
              isInvalid && !isLabelValidForAllLanguages(element.choices?.[choiceIdx]?.label, surveyLanguages)
            }
            className="border border-dashed"
            locale={locale}
            isStorageConfigured={isStorageConfigured}
          />
        )}
      </div>
      <div className="flex items-center gap-2">
        {isTextLocked && <PublishedLockNotice kind="optionText" />}
        <CopyIdButton id={choice.id} label={t("workspace.surveys.edit.copy_option_id")} />
        {(normalChoice.length > 1 || isSpecialChoice) && (
          <TooltipRenderer
            tooltipContent={
              isDeleteLocked
                ? t("workspace.surveys.edit.lock_explanation_option_delete")
                : t("workspace.surveys.edit.delete_choice")
            }
            className={isDeleteLocked ? "max-w-xs text-xs" : undefined}>
            <Button
              variant="secondary"
              size="icon"
              aria-label="Delete choice"
              disabled={isDeleteLocked}
              onClick={(e) => {
                e.preventDefault();
                deleteChoice(choiceIdx);
              }}>
              <TrashIcon />
            </Button>
          </TooltipRenderer>
        )}
        {!isSpecialChoice && (
          <TooltipRenderer tooltipContent={t("workspace.surveys.edit.add_choice_below")}>
            <Button
              variant="secondary"
              size="icon"
              aria-label="Add choice below"
              onClick={(e) => {
                e.preventDefault();
                addChoiceAndFocus(choiceIdx);
              }}>
              <PlusIcon />
            </Button>
          </TooltipRenderer>
        )}
      </div>
    </div>
  );
};
