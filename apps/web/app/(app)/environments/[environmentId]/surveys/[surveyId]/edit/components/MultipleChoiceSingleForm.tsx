"use client";

import { isLabelValidForAllLanguages } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/lib/validation";
import { createId } from "@paralleldrive/cuid2";
import { PlusIcon, TrashIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";

import { createI18nString, extractLanguageCodes } from "@formbricks/lib/i18n/utils";
import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import {
  TI18nString,
  TShuffleOption,
  TSurvey,
  TSurveyMultipleChoiceSingleQuestion,
  TSurveyQuestionType,
} from "@formbricks/types/surveys";
import { Button } from "@formbricks/ui/Button";
import { Label } from "@formbricks/ui/Label";
import { QuestionFormInput } from "@formbricks/ui/QuestionFormInput";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@formbricks/ui/Select";

interface OpenQuestionFormProps {
  localSurvey: TSurvey;
  question: TSurveyMultipleChoiceSingleQuestion;
  questionIdx: number;
  updateQuestion: (
    questionIdx: number,
    updatedAttributes: Partial<TSurveyMultipleChoiceSingleQuestion>
  ) => void;
  lastQuestion: boolean;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (language: string) => void;
  isInvalid: boolean;
}

export default function MultipleChoiceSingleForm({
  question,
  questionIdx,
  updateQuestion,
  isInvalid,
  localSurvey,
  selectedLanguageCode,
  setSelectedLanguageCode,
}: OpenQuestionFormProps): JSX.Element {
  const lastChoiceRef = useRef<HTMLInputElement>(null);
  const [isNew, setIsNew] = useState(true);
  const [showSubheader, setShowSubheader] = useState(!!question.subheader);
  const [isInvalidValue, setisInvalidValue] = useState<string | null>(null);
  const questionRef = useRef<HTMLInputElement>(null);
  const surveyLanguageCodes = extractLanguageCodes(localSurvey.languages);
  const surveyLanguages = localSurvey.languages ?? [];
  const shuffleOptionsTypes = {
    none: {
      id: "none",
      label: "Keep current order",
      show: true,
    },
    all: {
      id: "all",
      label: "Randomize all",
      show: question.choices.filter((c) => c.id === "other").length === 0,
    },
    exceptLast: {
      id: "exceptLast",
      label: "Randomize all except last option",
      show: true,
    },
  };

  const findDuplicateLabel = () => {
    for (let i = 0; i < question.choices.length; i++) {
      for (let j = i + 1; j < question.choices.length; j++) {
        if (
          getLocalizedValue(question.choices[i].label, selectedLanguageCode).trim() ===
          getLocalizedValue(question.choices[j].label, selectedLanguageCode).trim()
        ) {
          return getLocalizedValue(question.choices[i].label, selectedLanguageCode).trim(); // Return the duplicate label
        }
      }
    }
    return null;
  };

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
      let newL: string | string[] | undefined = logic.value;
      if (Array.isArray(logic.value)) {
        newL = logic.value.map((value) => (value === oldLabel ? newLabel : value));
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
    const newChoices = !question.choices ? [] : question.choices.filter((_, idx) => idx !== choiceIdx);
    const choiceValue = question.choices[choiceIdx].label[selectedLanguageCode];
    if (isInvalidValue === choiceValue) {
      setisInvalidValue(null);
    }
    let newLogic: any[] = [];
    question.logic?.forEach((logic) => {
      let newL: string | string[] | undefined = logic.value;
      if (Array.isArray(logic.value)) {
        newL = logic.value.filter((value) => value !== choiceValue);
      } else {
        newL = logic.value !== choiceValue ? logic.value : undefined;
      }
      newLogic.push({ ...logic, value: newL });
    });

    updateQuestion(questionIdx, { choices: newChoices, logic: newLogic });
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
        localSurvey={localSurvey}
        questionIdx={questionIdx}
        isInvalid={isInvalid}
        updateQuestion={updateQuestion}
        selectedLanguageCode={selectedLanguageCode}
        setSelectedLanguageCode={setSelectedLanguageCode}
      />

      <div>
        {showSubheader && (
          <div className="inline-flex w-full items-center">
            <div className="w-full">
              <QuestionFormInput
                id="subheader"
                value={question.subheader}
                localSurvey={localSurvey}
                questionIdx={questionIdx}
                isInvalid={isInvalid}
                updateQuestion={updateQuestion}
                selectedLanguageCode={selectedLanguageCode}
                setSelectedLanguageCode={setSelectedLanguageCode}
              />
            </div>

            <TrashIcon
              className="ml-2 mt-10 h-4 w-4 cursor-pointer text-slate-400 hover:text-slate-500"
              onClick={() => {
                setShowSubheader(false);
                updateQuestion(questionIdx, { subheader: undefined });
              }}
            />
          </div>
        )}
        {!showSubheader && (
          <Button
            size="sm"
            variant="minimal"
            className="mt-3"
            type="button"
            onClick={() => {
              updateQuestion(questionIdx, {
                subheader: createI18nString("", surveyLanguageCodes),
              });
              setShowSubheader(true);
            }}>
            {" "}
            <PlusIcon className="mr-1 h-4 w-4" />
            Add Description
          </Button>
        )}
      </div>

      <div className="mt-3">
        <Label htmlFor="choices">Options</Label>
        <div className="mt-2 -space-y-2" id="choices">
          {question.choices &&
            question.choices.map((choice, choiceIdx) => (
              <div className="inline-flex w-full items-center">
                <div className="flex w-full space-x-2">
                  <QuestionFormInput
                    key={choice.id}
                    id={`choice-${choiceIdx}`}
                    placeholder={choice.id === "other" ? "Other" : `Option ${choiceIdx + 1}`}
                    localSurvey={localSurvey}
                    questionIdx={questionIdx}
                    value={choice.label}
                    onBlur={() => {
                      const duplicateLabel = findDuplicateLabel();
                      if (duplicateLabel) {
                        toast.error("Duplicate choices");
                        setisInvalidValue(duplicateLabel);
                      } else {
                        setisInvalidValue(null);
                      }
                    }}
                    updateChoice={updateChoice}
                    selectedLanguageCode={selectedLanguageCode}
                    setSelectedLanguageCode={setSelectedLanguageCode}
                    isInvalid={
                      isInvalid &&
                      !isLabelValidForAllLanguages(question.choices[choiceIdx].label, surveyLanguages)
                    }
                    className={`${choice.id === "other" ? "border border-dashed" : ""}`}
                  />
                  {choice.id === "other" && (
                    <QuestionFormInput
                      id="otherOptionPlaceholder"
                      localSurvey={localSurvey}
                      placeholder={"Please specify"}
                      questionIdx={questionIdx}
                      value={
                        question.otherOptionPlaceholder
                          ? question.otherOptionPlaceholder
                          : createI18nString("Please specify", surveyLanguageCodes)
                      }
                      updateQuestion={updateQuestion}
                      selectedLanguageCode={selectedLanguageCode}
                      setSelectedLanguageCode={setSelectedLanguageCode}
                      isInvalid={
                        isInvalid &&
                        !isLabelValidForAllLanguages(question.choices[choiceIdx].label, surveyLanguages)
                      }
                      className="border border-dashed"
                    />
                  )}
                </div>
                {question.choices && question.choices.length > 2 && (
                  <TrashIcon
                    className="ml-2 h-4 w-4 cursor-pointer text-slate-400 hover:text-slate-500"
                    onClick={() => deleteChoice(choiceIdx)}
                  />
                )}
                <div className="ml-2 h-4 w-4">
                  {choice.id !== "other" && (
                    <PlusIcon
                      className="h-full w-full cursor-pointer text-slate-400 hover:text-slate-500"
                      onClick={() => addChoice(choiceIdx)}
                    />
                  )}
                </div>
              </div>
            ))}
          <div className="flex items-center justify-between space-x-2">
            {question.choices.filter((c) => c.id === "other").length === 0 && (
              <Button size="sm" variant="minimal" type="button" onClick={() => addOther()}>
                Add &quot;Other&quot;
              </Button>
            )}
            <Button
              size="sm"
              variant="minimal"
              type="button"
              onClick={() => {
                // @ts-expect-error
                updateQuestion(questionIdx, { type: TSurveyQuestionType.MultipleChoiceMulti });
              }}>
              Convert to Multi Select
            </Button>

            <div className="flex flex-1 items-center justify-end gap-2">
              <Select
                defaultValue={question.shuffleOption}
                value={question.shuffleOption}
                onValueChange={(e: TShuffleOption) => {
                  updateQuestion(questionIdx, { shuffleOption: e });
                }}>
                <SelectTrigger className="w-fit space-x-2 overflow-hidden border-0 font-semibold text-slate-600">
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
      </div>
    </form>
  );
}
