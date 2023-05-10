import { Logic, Question, LogicCondition } from "@formbricks/types/questions";
import { Survey } from "@formbricks/types/surveys";
import Button from "@formbricks/ui/Button";
import { Label } from "@formbricks/ui/Label";
import { ForwardIcon } from "@heroicons/react/24/outline";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@formbricks/ui/Select";
import { TrashIcon } from "@heroicons/react/24/solid";
import { BsArrowReturnRight, BsArrowDown } from "react-icons/bs";
import { use, useEffect, useMemo } from "react";

interface LogicEditorProps {
  localSurvey: Survey;
  questionIdx: number;
  question: Question;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
}

type LogicConditions = {
  [K in LogicCondition]: {
    label: string;
    values: string[] | null;
    unique?: boolean;
    multiSelect?: boolean;
  };
};

export default function LogicEditor({
  localSurvey,
  question,
  questionIdx,
  updateQuestion,
}: LogicEditorProps) {
  const questionValues = useMemo(() => {
    if ("choices" in question) {
      return question.choices.map((choice) => choice.label);
    } else if ("range" in question) {
      return Array.from({ length: question.range }, (_, i) => (i + 1).toString());
    }
    return [];
  }, [question]);

  const conditions = {
    openText: ["submitted", "skipped"],
    multipleChoiceSingle: ["submitted", "equals", "notEquals"],
    multipleChoiceMulti: ["submitted", "skipped", "includesAll", "includesOne", "equals"],
    nps: ["equals", "notEquals", "lessThan", "lessEqual", "greaterThan", "greaterEqual", "submitted"],
    rating: ["equals", "notEquals", "lessThan", "lessEqual", "greaterThan", "greaterEqual", "submitted"],
  };
  const logicConditions: LogicConditions = {
    submitted: {
      label: "is submitted",
      values: null,
      unique: true,
    },
    skipped: {
      label: "is skipped",
      values: null,
      unique: true,
    },
    equals: {
      label: "equals",
      values: questionValues,
    },
    notEquals: {
      label: "does not equal",
      values: questionValues,
    },
    lessThan: {
      label: "is less than",
      values: questionValues,
    },
    lessEqual: {
      label: "is less or equal to",
      values: questionValues,
    },
    greaterThan: {
      label: "is greater than",
      values: questionValues,
    },
    greaterEqual: {
      label: "is greater or equal to",
      values: questionValues,
    },
    includesAll: {
      label: "includes all of",
      values: questionValues,
      multiSelect: true,
    },
    includesOne: {
      label: "includes one of",
      values: questionValues,
      multiSelect: true,
    },
  };

  useEffect(() => {
    console.log(question);
  }, [question]);

  const addLogic = () => {
    const newLogic: Logic[] = !question.logic ? [] : question.logic;
    newLogic.push({
      condition: undefined,
      value: undefined,
      destination: undefined,
    });
    updateQuestion(questionIdx, { logic: newLogic });
  };

  const updateLogic = (logicIdx: number, updatedAttributes: any) => {
    if (updatedAttributes.condition && logicConditions[updatedAttributes.condition].values == null) {
      updatedAttributes.value = undefined;
    }

    const newLogic = !question.logic
      ? []
      : question.logic.map((logic, idx) => {
          if (idx === logicIdx) {
            return { ...logic, ...updatedAttributes };
          }
          return logic;
        });

    updateQuestion(questionIdx, { logic: newLogic });
  };

  const deleteLogic = (logicIdx: number) => {
    const newLogic = !question.logic ? [] : question.logic.filter((_: any, idx: number) => idx !== logicIdx);
    updateQuestion(questionIdx, { logic: newLogic });
  };

  const truncate = (str: string, n: number) => (str.length > n ? str.substring(0, n - 1) + "..." : str);

  return (
    question.type in conditions && (
      <div className="mt-3">
        <Label>Logic Jumps</Label>

        {question?.logic && question?.logic?.length !== 0 && (
          <div className="mt-2 space-y-3">
            {question?.logic?.map((logic, logicIdx) => (
              <div key={logicIdx} className="flex flex-wrap items-center space-x-2 space-y-1 text-sm">
                <BsArrowReturnRight className="h-4 w-4" />
                <p>If this answer</p>

                <Select
                  defaultValue={logic.condition}
                  onValueChange={(e) => updateLogic(logicIdx, { condition: e })}>
                  <SelectTrigger className="w-fit dark:text-slate-200">
                    <SelectValue placeholder="select condition" />
                  </SelectTrigger>
                  <SelectContent>
                    {conditions[question.type].map((condition) => (
                      <SelectItem key={condition} value={condition}>
                        {logicConditions[condition].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {logic.condition && logicConditions[logic.condition].values != null && (
                  <Select
                    // defaultValue={logic.value}
                    onValueChange={(e) => updateLogic(logicIdx, { value: e })}>
                    <SelectTrigger className="w-fit dark:text-slate-200">
                      <SelectValue placeholder="select match type" />
                    </SelectTrigger>
                    <SelectContent>
                      {logicConditions[logic.condition].values?.map((value) => (
                        <SelectItem key={value} value={value}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <p>skip to</p>

                <Select
                  defaultValue={logic.destination}
                  onValueChange={(e) => updateLogic(logicIdx, { destination: e })}>
                  <SelectTrigger className="w-[180px] overflow-hidden dark:text-slate-200">
                    <SelectValue placeholder="select question" />
                  </SelectTrigger>
                  <SelectContent>
                    {localSurvey.questions.map(
                      (question, idx) =>
                        idx !== questionIdx && (
                          <SelectItem key={question.id} value={question.id}>
                            {idx + 1} - {truncate(question.headline, 14)}
                          </SelectItem>
                        )
                    )}
                  </SelectContent>
                </Select>

                <TrashIcon
                  className="ml-2 h-4 w-4 cursor-pointer text-slate-400"
                  onClick={() => deleteLogic(idx)}
                />
              </div>
            ))}
            <div className="flex flex-wrap items-center space-x-2 text-sm">
              <BsArrowDown className="h-4 w-4" />
              <p>All other answers will continue to the next question</p>
            </div>
          </div>
        )}

        <div className="mt-2">
          <Button
            id="logicJumps"
            type="button"
            name="logicJumps"
            variant="secondary"
            EndIcon={ForwardIcon}
            onClick={() => addLogic()}>
            Add Logic
          </Button>
        </div>
      </div>
    )
  );
}
