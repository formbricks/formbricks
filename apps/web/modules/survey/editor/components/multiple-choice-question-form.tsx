"use client";

import { QuestionFormInput } from "@/modules/survey/components/question-form-input";
import { QuestionOptionChoice } from "@/modules/survey/editor/components/question-option-choice";
import { findOptionUsedInLogic } from "@/modules/survey/editor/lib/utils";
import { Button } from "@/modules/ui/components/button";
import { Label } from "@/modules/ui/components/label";
import { ShuffleOptionSelect } from "@/modules/ui/components/shuffle-option-select";
import { DndContext } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { createId } from "@paralleldrive/cuid2";
import { useTranslate } from "@tolgee/react";
import { PlusIcon } from "lucide-react";
import { type JSX, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { createI18nString, extractLanguageCodes } from "@formbricks/lib/i18n/utils";
import {
  TI18nString,
  TShuffleOption,
  TSurvey,
  TSurveyMultipleChoiceQuestion,
  TSurveyQuestionTypeEnum,
} from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";

interface MultipleChoiceQuestionFormProps {
  localSurvey: TSurvey;
  question: TSurveyMultipleChoiceQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: Partial<TSurveyMultipleChoiceQuestion>) => void;
  lastQuestion: boolean;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (language: string) => void;
  isInvalid: boolean;
  locale: TUserLocale;
}

export const MultipleChoiceQuestionForm = ({
  question,
  questionIdx,
  updateQuestion,
  isInvalid,
  localSurvey,
  selectedLanguageCode,
  setSelectedLanguageCode,
  locale,
}: MultipleChoiceQuestionFormProps): JSX.Element => {
  const { t } = useTranslate();
  const lastChoiceRef = useRef<HTMLInputElement>(null);
  const [isNew, setIsNew] = useState(true);
  const [isInvalidValue, setisInvalidValue] = useState<string | null>(null);

  const questionRef = useRef<HTMLInputElement>(null);
  const surveyLanguageCodes = extractLanguageCodes(localSurvey.languages);
  const surveyLanguages = localSurvey.languages ?? [];
  const shuffleOptionsTypes = {
    none: {
      id: "none",
      label: t("environments.surveys.edit.keep_current_order"),
      show: true,
    },
    all: {
      id: "all",
      label: t("environments.surveys.edit.randomize_all"),
      show: question.choices.filter((c) => c.id === "other").length === 0,
    },
    exceptLast: {
      id: "exceptLast",
      label: t("environments.surveys.edit.randomize_all_except_last"),
      show: true,
    },
  };

  const updateChoice = (choiceIdx: number, updatedAttributes: { label: TI18nString }) => {
    let newChoices: any[] = [];
    if (question.choices) {
      newChoices = question.choices.map((choice, idx) => {
        if (idx !== choiceIdx) return choice;
        return { ...choice, ...updatedAttributes };
      });
    }

    updateQuestion(questionIdx, {
      choices: newChoices,
    });
  };

  const addChoice = (choiceIdx?: number) => {
    setIsNew(false); // This question is no longer new.
    let newChoices = !question.choices ? [] : question.choices;
    const otherChoice = newChoices.find((choice) => choice.id === "other");
    if (otherChoice) {
      newChoices = newChoices.filter((choice) => choice.id !== "other");
    }
    const newChoice = {
      id: createId(),
      label: createI18nString("", surveyLanguageCodes),
    };
    if (choiceIdx !== undefined) {
      newChoices.splice(choiceIdx + 1, 0, newChoice);
    } else {
      newChoices.push(newChoice);
    }
    if (otherChoice) {
      newChoices.push(otherChoice);
    }
    updateQuestion(questionIdx, { choices: newChoices });
  };

  const addOther = () => {
    if (question.choices.filter((c) => c.id === "other").length === 0) {
      const newChoices = !question.choices ? [] : question.choices.filter((c) => c.id !== "other");
      newChoices.push({
        id: "other",
        label: createI18nString("Other", surveyLanguageCodes),
      });
      updateQuestion(questionIdx, {
        choices: newChoices,
        ...(question.shuffleOption === shuffleOptionsTypes.all.id && {
          shuffleOption: shuffleOptionsTypes.exceptLast.id as TShuffleOption,
        }),
      });
    }
  };

  const deleteChoice = (choiceIdx: number) => {
    const choiceToDelete = question.choices[choiceIdx].id;

    if (choiceToDelete !== "other") {
      const questionIdx = findOptionUsedInLogic(localSurvey, question.id, choiceToDelete);
      if (questionIdx !== -1) {
        toast.error(
          t("environments.surveys.edit.option_used_in_logic_error", {
            questionIndex: questionIdx + 1,
          })
        );
        return;
      }
    }

    const newChoices = !question.choices ? [] : question.choices.filter((_, idx) => idx !== choiceIdx);
    const choiceValue = question.choices[choiceIdx].label[selectedLanguageCode];
    if (isInvalidValue === choiceValue) {
      setisInvalidValue(null);
    }

    updateQuestion(questionIdx, {
      choices: newChoices,
    });
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

  // Auto animate
  const [parent] = useAutoAnimate();
  return (
    <form>
      <QuestionFormInput
        id="headline"
        value={question.headline}
        label={t("environments.surveys.edit.question") + "*"}
        localSurvey={localSurvey}
        questionIdx={questionIdx}
        isInvalid={isInvalid}
        updateQuestion={updateQuestion}
        selectedLanguageCode={selectedLanguageCode}
        setSelectedLanguageCode={setSelectedLanguageCode}
        locale={locale}
      />

      <div ref={parent}>
        {question.subheader !== undefined && (
          <div className="inline-flex w-full items-center">
            <div className="w-full">
              <QuestionFormInput
                id="subheader"
                value={question.subheader}
                label={t("common.description")}
                localSurvey={localSurvey}
                questionIdx={questionIdx}
                isInvalid={isInvalid}
                updateQuestion={updateQuestion}
                selectedLanguageCode={selectedLanguageCode}
                setSelectedLanguageCode={setSelectedLanguageCode}
                locale={locale}
              />
            </div>
          </div>
        )}
        {question.subheader === undefined && (
          <Button
            size="sm"
            variant="secondary"
            className="mt-3"
            type="button"
            onClick={() => {
              updateQuestion(questionIdx, {
                subheader: createI18nString("", surveyLanguageCodes),
              });
            }}>
            <PlusIcon className="mr-1 h-4 w-4" />
            {t("environments.surveys.edit.add_description")}
          </Button>
        )}
      </div>

      <div className="mt-3">
        <Label htmlFor="choices">Options*</Label>
        <div className="mt-2" id="choices">
          <DndContext
            id="multi-choice-choices"
            onDragEnd={(event) => {
              const { active, over } = event;

              if (active.id === "other" || over?.id === "other") {
                return;
              }

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
              <div className="flex flex-col gap-2" ref={parent}>
                {question.choices &&
                  question.choices.map((choice, choiceIdx) => (
                    <QuestionOptionChoice
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
                      locale={locale}
                    />
                  ))}
              </div>
            </SortableContext>
          </DndContext>
          <div className="mt-2 flex items-center justify-between space-x-2">
            {question.choices.filter((c) => c.id === "other").length === 0 && (
              <Button size="sm" variant="secondary" type="button" onClick={() => addOther()}>
                {t("environments.surveys.edit.add_other")}
              </Button>
            )}
            <Button
              size="sm"
              variant="secondary"
              type="button"
              onClick={() => {
                updateQuestion(questionIdx, {
                  type:
                    question.type === TSurveyQuestionTypeEnum.MultipleChoiceMulti
                      ? TSurveyQuestionTypeEnum.MultipleChoiceSingle
                      : TSurveyQuestionTypeEnum.MultipleChoiceMulti,
                });
              }}>
              {question.type === TSurveyQuestionTypeEnum.MultipleChoiceSingle
                ? t("environments.surveys.edit.convert_to_multiple_choice")
                : t("environments.surveys.edit.convert_to_single_choice")}
            </Button>

            <div className="flex flex-1 items-center justify-end gap-2">
              <ShuffleOptionSelect
                questionIdx={questionIdx}
                shuffleOption={question.shuffleOption}
                updateQuestion={updateQuestion}
                shuffleOptionsTypes={shuffleOptionsTypes}
              />
            </div>
          </div>
        </div>
      </div>
    </form>
  );
};
