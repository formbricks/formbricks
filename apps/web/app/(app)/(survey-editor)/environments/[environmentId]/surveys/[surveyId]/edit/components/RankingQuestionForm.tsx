"use client";

import { QuestionFormInput } from "@/modules/surveys/components/QuestionFormInput";
import { DndContext } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { createId } from "@paralleldrive/cuid2";
import { PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { type JSX, useEffect, useRef, useState } from "react";
import { createI18nString, extractLanguageCodes } from "@formbricks/lib/i18n/utils";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import { TI18nString, TSurvey, TSurveyRankingQuestion } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { Button } from "@formbricks/ui/components/Button";
import { Label } from "@formbricks/ui/components/Label";
import { ShuffleOptionSelect } from "@formbricks/ui/components/ShuffleOptionSelect";
import { QuestionOptionChoice } from "./QuestionOptionChoice";

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
  locale: TUserLocale;
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
  locale,
}: RankingQuestionFormProps): JSX.Element => {
  const t = useTranslations();
  const lastChoiceRef = useRef<HTMLInputElement>(null);
  const [isInvalidValue, setIsInvalidValue] = useState<string | null>(null);

  const surveyLanguageCodes = extractLanguageCodes(localSurvey.languages);
  const surveyLanguages = localSurvey.languages ?? [];

  const updateChoice = (choiceIdx: number, updatedAttributes: { label: TI18nString }) => {
    if (question.choices) {
      const newChoices = question.choices.map((choice, idx) => {
        if (idx !== choiceIdx) return choice;
        return { ...choice, ...updatedAttributes };
      });

      updateQuestion(questionIdx, { choices: newChoices });
    }
  };

  const addChoice = (choiceIdx: number) => {
    let newChoices = !question.choices ? [] : question.choices;

    const newChoice = {
      id: createId(),
      label: createI18nString("", surveyLanguageCodes),
    };

    updateQuestion(questionIdx, {
      choices: [...newChoices.slice(0, choiceIdx + 1), newChoice, ...newChoices.slice(choiceIdx + 1)],
    });
  };

  const addOption = () => {
    const choices = !question.choices ? [] : question.choices;

    const newChoice = {
      id: createId(),
      label: createI18nString("", surveyLanguageCodes),
    };

    updateQuestion(questionIdx, { choices: [...choices, newChoice] });
  };

  const deleteChoice = (choiceIdx: number) => {
    const newChoices = !question.choices ? [] : question.choices.filter((_, idx) => idx !== choiceIdx);
    const choiceValue = question.choices[choiceIdx].label[selectedLanguageCode];

    if (isInvalidValue === choiceValue) {
      setIsInvalidValue(null);
    }

    updateQuestion(questionIdx, { choices: newChoices });
  };

  const shuffleOptionsTypes = {
    none: {
      id: "none",
      label: t("environments.surveys.edit.keep_current_order"),
      show: true,
    },
    all: {
      id: "all",
      label: t("environments.surveys.edit.randomize_all"),
      show: question.choices.length > 0,
    },
  };

  useEffect(() => {
    if (lastChoiceRef.current) {
      lastChoiceRef.current?.focus();
    }
  }, [question.choices?.length]);

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
        attributeClasses={attributeClasses}
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
                attributeClasses={attributeClasses}
                locale={locale}
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
            {t("environments.surveys.edit.add_description")}
          </Button>
        )}
      </div>

      <div className="mt-3">
        <Label htmlFor="choices">{t("environments.surveys.edit.options")}*</Label>
        <div className="mt-2" id="choices">
          <DndContext
            id="ranking-choices"
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
              <div className="flex flex-col" ref={parent}>
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
                      attributeClasses={attributeClasses}
                      locale={locale}
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
              onClick={() => addOption()}>
              {t("environments.surveys.edit.add_option")}
            </Button>
            <ShuffleOptionSelect
              shuffleOptionsTypes={shuffleOptionsTypes}
              updateQuestion={updateQuestion}
              shuffleOption={question.shuffleOption}
              questionIdx={questionIdx}
            />
          </div>
        </div>
      </div>
    </form>
  );
};
