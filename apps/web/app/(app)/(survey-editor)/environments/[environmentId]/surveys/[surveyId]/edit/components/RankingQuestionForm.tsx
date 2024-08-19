"use client";

import { DndContext } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { createId } from "@paralleldrive/cuid2";
import { PlusIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createI18nString, extractLanguageCodes, getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import {
  TI18nString,
  TShuffleOption,
  TSurvey,
  TSurveyRankingQuestion,
} from "@formbricks/types/surveys/types";
import { Button } from "@formbricks/ui/Button";
import { Label } from "@formbricks/ui/Label";
import { QuestionFormInput } from "@formbricks/ui/QuestionFormInput";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@formbricks/ui/Select";
import { SelectQuestionChoice } from "./SelectQuestionChoice";

interface RankingQuestionFormProps {
  localSurvey: TSurvey;
  question: TSurveyRankingQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: Partial<TSurveyRankingQuestion>) => void;
  lastQuestion: boolean;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (language: string) => void;
  isInvalid: boolean;
  attributeClasses: TAttributeClass[];
}

export const RankingQuestionForm = ({
  question,
  questionIdx,
  updateQuestion,
  isInvalid,
  localSurvey,
  selectedLanguageCode,
  setSelectedLanguageCode,
  attributeClasses,
}: RankingQuestionFormProps): JSX.Element => {
  const lastChoiceRef = useRef<HTMLInputElement>(null);
  const [isNew, setIsNew] = useState(true);
  const [isInvalidValue, setisInvalidValue] = useState<string | null>(null);

  const questionRef = useRef<HTMLInputElement>(null);
  const surveyLanguageCodes = extractLanguageCodes(localSurvey.languages);
  const surveyLanguages = localSurvey.languages ?? [];

  const updateChoice = (choiceIdx: number, updatedAttributes: { label: TI18nString }) => {
    const newLabel = updatedAttributes.label.en;
    const oldLabel = question.choices[choiceIdx].label;
    let newChoices: any[] = [];
    if (question.choices) {
      newChoices = question.choices.map((choice, idx) => {
        if (idx !== choiceIdx) return choice;
        return { ...choice, ...updatedAttributes };
      });
    }

    let newLogic: any[] = [];
    question.logic?.forEach((logic) => {
      let newL: string | string[] | undefined | number = logic.value;
      if (Array.isArray(logic.value)) {
        newL = logic.value.map((value) =>
          value === getLocalizedValue(oldLabel, selectedLanguageCode) ? newLabel : value
        );
      } else {
        newL = logic.value === getLocalizedValue(oldLabel, selectedLanguageCode) ? newLabel : logic.value;
      }
      newLogic.push({ ...logic, value: newL });
    });
    updateQuestion(questionIdx, { choices: newChoices, logic: newLogic });
  };

  const addChoice = (choiceIdx?: number) => {
    setIsNew(false); // This question is no longer new.
    let newChoices = !question.choices ? [] : question.choices;

    const newChoice = {
      id: createId(),
      label: createI18nString("", surveyLanguageCodes),
    };
    if (choiceIdx !== undefined) {
      newChoices.splice(choiceIdx + 1, 0, newChoice);
    } else {
      newChoices.push(newChoice);
    }

    updateQuestion(questionIdx, { choices: newChoices });
  };

  const deleteChoice = (choiceIdx: number) => {
    const newChoices = !question.choices ? [] : question.choices.filter((_, idx) => idx !== choiceIdx);
    const choiceValue = question.choices[choiceIdx].label[selectedLanguageCode];
    if (isInvalidValue === choiceValue) {
      setisInvalidValue(null);
    }
    let newLogic: any[] = [];
    question.logic?.forEach((logic) => {
      let newL: string | string[] | undefined | number = logic.value;
      if (Array.isArray(logic.value)) {
        newL = logic.value.filter((value) => value !== choiceValue);
      } else {
        newL = logic.value !== choiceValue ? logic.value : undefined;
      }
      newLogic.push({ ...logic, value: newL });
    });

    updateQuestion(questionIdx, { choices: newChoices, logic: newLogic });
  };

  const shuffleOptionsTypes = {
    none: {
      id: "none",
      label: "Keep current order",
      show: true,
    },
    all: {
      id: "all",
      label: "Randomize all",
      show: question.choices.length > 0,
    },
  };

  useEffect(() => {
    if (lastChoiceRef.current) {
      lastChoiceRef.current?.focus();
    }
  }, [question.choices?.length]);

  // This effect will run once on initial render, setting focus to the question input.
  useEffect(() => {
    if (isNew && questionRef.current) {
      questionRef.current.focus();
    }
  }, [isNew]);

  return (
    <form>
      <QuestionFormInput
        id="headline"
        value={question.headline}
        label={"Question*"}
        localSurvey={localSurvey}
        questionIdx={questionIdx}
        isInvalid={isInvalid}
        updateQuestion={updateQuestion}
        selectedLanguageCode={selectedLanguageCode}
        setSelectedLanguageCode={setSelectedLanguageCode}
        attributeClasses={attributeClasses}
      />

      <div>
        {question.subheader !== undefined && (
          <div className="inline-flex w-full items-center">
            <div className="w-full">
              <QuestionFormInput
                id="subheader"
                value={question.subheader}
                label={"Description"}
                localSurvey={localSurvey}
                questionIdx={questionIdx}
                isInvalid={isInvalid}
                updateQuestion={updateQuestion}
                selectedLanguageCode={selectedLanguageCode}
                setSelectedLanguageCode={setSelectedLanguageCode}
                attributeClasses={attributeClasses}
              />
            </div>
          </div>
        )}
        {question.subheader === undefined && (
          <Button
            size="sm"
            variant="minimal"
            className="mt-3"
            type="button"
            onClick={() => {
              updateQuestion(questionIdx, {
                subheader: createI18nString("", surveyLanguageCodes),
              });
            }}>
            <PlusIcon className="mr-1 h-4 w-4" />
            Add Description
          </Button>
        )}
      </div>

      <div className="mt-3">
        <Label htmlFor="choices">Options*</Label>
        <div className="mt-2" id="choices">
          <DndContext
            onDragEnd={(event) => {
              const { active, over } = event;

              if (!active || !over) {
                return;
              }

              const activeIndex = question.choices.findIndex((choice) => choice.id === active.id);
              const overIndex = question.choices.findIndex((choice) => choice.id === over.id);

              const newChoices = [...question.choices];

              newChoices.splice(activeIndex, 1);
              newChoices.splice(overIndex, 0, question.choices[activeIndex]);

              updateQuestion(questionIdx, { choices: newChoices });
            }}>
            <SortableContext items={question.choices} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col">
                {question.choices &&
                  question.choices.map((choice, choiceIdx) => (
                    <SelectQuestionChoice
                      key={choice.id}
                      choice={choice}
                      choiceIdx={choiceIdx}
                      questionIdx={questionIdx}
                      updateChoice={updateChoice}
                      deleteChoice={deleteChoice}
                      addChoice={addChoice}
                      isInvalid={isInvalid}
                      localSurvey={localSurvey}
                      selectedLanguageCode={selectedLanguageCode}
                      setSelectedLanguageCode={setSelectedLanguageCode}
                      surveyLanguages={surveyLanguages}
                      question={question}
                      updateQuestion={updateQuestion}
                      surveyLanguageCodes={surveyLanguageCodes}
                      attributeClasses={attributeClasses}
                    />
                  ))}
              </div>
            </SortableContext>
          </DndContext>

          <div className="mt-2 flex flex-1 items-center justify-between gap-2">
            <Button
              size="sm"
              variant="secondary"
              EndIcon={PlusIcon}
              type="button"
              onClick={() => addChoice()}>
              Add option
            </Button>
            <Select
              defaultValue={question.shuffleOption}
              value={question.shuffleOption}
              onValueChange={(e: TShuffleOption) => {
                updateQuestion(questionIdx, { shuffleOption: e });
              }}>
              <SelectTrigger className="w-fit space-x-2 overflow-hidden border-0 font-medium text-slate-600">
                <SelectValue placeholder="Select ordering" />
              </SelectTrigger>
              <SelectContent>
                {Object.values(shuffleOptionsTypes).map(
                  (shuffleOptionsType) =>
                    shuffleOptionsType.show && (
                      <SelectItem
                        key={shuffleOptionsType.id}
                        value={shuffleOptionsType.id}
                        title={shuffleOptionsType.label}>
                        {shuffleOptionsType.label}
                      </SelectItem>
                    )
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </form>
  );
};
