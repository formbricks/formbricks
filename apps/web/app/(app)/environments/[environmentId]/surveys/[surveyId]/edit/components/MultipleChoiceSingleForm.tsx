"use client";

import { createId } from "@paralleldrive/cuid2";
import { PlusIcon, TrashIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@formbricks/lib/cn";
import { TSurvey, TSurveyMultipleChoiceSingleQuestion } from "@formbricks/types/surveys";
import { Button } from "@formbricks/ui/Button";
import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";
import QuestionFormInput from "@formbricks/ui/QuestionFormInput";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@formbricks/ui/Select";

interface OpenQuestionFormProps {
  localSurvey: TSurvey;
  question: TSurveyMultipleChoiceSingleQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  lastQuestion: boolean;
  isInvalid: boolean;
}

export default function MultipleChoiceSingleForm({
  question,
  questionIdx,
  updateQuestion,
  isInvalid,
  localSurvey,
}: OpenQuestionFormProps): JSX.Element {
  const lastChoiceRef = useRef<HTMLInputElement>(null);
  const [isNew, setIsNew] = useState(true);
  const [showSubheader, setShowSubheader] = useState(!!question.subheader);
  const [isInvalidValue, setisInvalidValue] = useState<string | null>(null);
  const questionRef = useRef<HTMLInputElement>(null);

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
        if (question.choices[i].label.trim() === question.choices[j].label.trim()) {
          return question.choices[i].label.trim(); // Return the duplicate label
        }
      }
    }
    return null;
  };

  const findEmptyLabel = () => {
    for (let i = 0; i < question.choices.length; i++) {
      if (question.choices[i].label.trim() === "") return true;
    }
    return false;
  };

  const updateChoice = (choiceIdx: number, updatedAttributes: { label: string }) => {
    const newLabel = updatedAttributes.label;
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
        newL = logic.value === oldLabel ? newLabel : logic.value;
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
    const newChoice = { id: createId(), label: "" };
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
      newChoices.push({ id: "other", label: "Other" });
      updateQuestion(questionIdx, {
        choices: newChoices,
        ...(question.shuffleOption === shuffleOptionsTypes.all.id && {
          shuffleOption: shuffleOptionsTypes.exceptLast.id,
        }),
      });
    }
  };

  const deleteChoice = (choiceIdx: number) => {
    const newChoices = !question.choices ? [] : question.choices.filter((_, idx) => idx !== choiceIdx);

    const choiceValue = question.choices[choiceIdx].label;
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

  const environmentId = localSurvey.environmentId;

  return (
    <form>
      <QuestionFormInput
        localSurvey={localSurvey}
        environmentId={environmentId}
        isInvalid={isInvalid}
        ref={questionRef}
        questionId={question.id}
        questionIdx={questionIdx}
        updateQuestion={updateQuestion}
        type="headline"
      />

      <div>
        {showSubheader && (
          <>
            <div className="flex w-full items-center">
              <QuestionFormInput
                localSurvey={localSurvey}
                environmentId={environmentId}
                isInvalid={isInvalid}
                questionId={question.id}
                questionIdx={questionIdx}
                updateQuestion={updateQuestion}
                type="subheader"
              />
              <TrashIcon
                className="ml-2 mt-10 h-4 w-4 cursor-pointer text-slate-400 hover:text-slate-500"
                onClick={() => {
                  setShowSubheader(false);
                  updateQuestion(questionIdx, { subheader: "" });
                }}
              />
            </div>
          </>
        )}
        {!showSubheader && (
          <Button
            size="sm"
            variant="minimal"
            className="mt-3"
            type="button"
            onClick={() => setShowSubheader(true)}>
            <PlusIcon className="mr-1 h-4 w-4" />
            Add Description
          </Button>
        )}
      </div>

      <div className="mt-3">
        <Label htmlFor="choices">Options</Label>
        <div className="mt-2 space-y-2" id="choices">
          {question.choices &&
            question.choices.map((choice, choiceIdx) => (
              <div key={choiceIdx} className="flex w-full items-center">
                <div className="flex w-full space-x-2">
                  <Input
                    ref={choiceIdx === question.choices.length - 1 ? lastChoiceRef : null}
                    id={choice.id}
                    name={choice.id}
                    value={choice.label}
                    className={cn(choice.id === "other" && "border-dashed")}
                    placeholder={choice.id === "other" ? "Other" : `Option ${choiceIdx + 1}`}
                    onBlur={() => {
                      const duplicateLabel = findDuplicateLabel();
                      if (duplicateLabel) {
                        setisInvalidValue(duplicateLabel);
                      } else if (findEmptyLabel()) {
                        setisInvalidValue("");
                      } else {
                        setisInvalidValue(null);
                      }
                    }}
                    onChange={(e) => updateChoice(choiceIdx, { label: e.target.value })}
                    isInvalid={
                      (isInvalidValue === "" && choice.label.trim() === "") ||
                      (isInvalidValue !== null && choice.label.trim() === isInvalidValue.trim())
                    }
                  />
                  {choice.id === "other" && (
                    <Input
                      id="otherInputLabel"
                      name="otherInputLabel"
                      value={question.otherOptionPlaceholder ?? "Please specify"}
                      placeholder={question.otherOptionPlaceholder ?? "Please specify"}
                      className={cn(choice.id === "other" && "border-dashed")}
                      onChange={(e) => {
                        if (e.target.value.trim() == "") e.target.value = "";
                        updateQuestion(questionIdx, { otherOptionPlaceholder: e.target.value });
                      }}
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
                updateQuestion(questionIdx, { type: "multipleChoiceMulti" });
              }}>
              Convert to Multi Select
            </Button>

            <div className="flex flex-1 items-center justify-end gap-2">
              <Select
                defaultValue={question.shuffleOption}
                value={question.shuffleOption}
                onValueChange={(e) => {
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
