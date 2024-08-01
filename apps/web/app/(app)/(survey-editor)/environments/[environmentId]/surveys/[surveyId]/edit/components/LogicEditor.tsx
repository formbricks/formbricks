import {
  ArrowDownIcon,
  ChevronDown,
  CornerDownRightIcon,
  HelpCircle,
  SplitIcon,
  TrashIcon,
} from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { structuredClone } from "@formbricks/lib/pollyfills/structuredClone";
import { replaceHeadlineRecall } from "@formbricks/lib/utils/recall";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import {
  TSurvey,
  TSurveyLogic,
  TSurveyLogicCondition,
  TSurveyQuestion,
  TSurveyQuestionTypeEnum,
} from "@formbricks/types/surveys/types";
import { Button } from "@formbricks/ui/Button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@formbricks/ui/DropdownMenu";
import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@formbricks/ui/Select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@formbricks/ui/Tooltip";

interface LogicEditorProps {
  localSurvey: TSurvey;
  questionIdx: number;
  question: TSurveyQuestion;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  attributeClasses: TAttributeClass[];
}

type LogicConditions = {
  [K in TSurveyLogicCondition]: {
    label: string;
    values: string[] | null;
    unique?: boolean;
    multiSelect?: boolean;
  };
};

const conditions = {
  openText: ["submitted", "skipped"],
  multipleChoiceSingle: ["submitted", "skipped", "equals", "notEquals", "includesOne"],
  multipleChoiceMulti: ["submitted", "skipped", "includesAll", "includesOne", "equals"],
  nps: [
    "equals",
    "notEquals",
    "lessThan",
    "lessEqual",
    "greaterThan",
    "greaterEqual",
    "submitted",
    "skipped",
  ],
  rating: [
    "equals",
    "notEquals",
    "lessThan",
    "lessEqual",
    "greaterThan",
    "greaterEqual",
    "submitted",
    "skipped",
  ],
  cta: ["clicked", "skipped"],
  consent: ["skipped", "accepted"],
  pictureSelection: ["submitted", "skipped", "includesAll", "includesOne", "equals"],
  fileUpload: ["uploaded", "notUploaded"],
  cal: ["skipped", "booked"],
  matrix: ["isCompletelySubmitted", "isPartiallySubmitted", "skipped"],
  address: ["submitted", "skipped"],
};

export const LogicEditor = ({
  localSurvey,
  question,
  questionIdx,
  updateQuestion,
  attributeClasses,
}: LogicEditorProps) => {
  const [searchValue, setSearchValue] = useState<string>("");
  const showDropdownSearch = question.type !== "pictureSelection";
  const transformedSurvey = useMemo(() => {
    return replaceHeadlineRecall(localSurvey, "default", attributeClasses);
  }, [localSurvey, attributeClasses]);

  const questionValues: string[] = useMemo(() => {
    if ("choices" in question) {
      if (question.type === "pictureSelection") {
        return question.choices.map((choice) => choice.id);
      } else {
        return question.choices.map((choice) => getLocalizedValue(choice.label, "default"));
      }
    } else if ("range" in question) {
      return Array.from({ length: question.range ? question.range : 0 }, (_, i) => (i + 1).toString());
    } else if (question.type === TSurveyQuestionTypeEnum.NPS) {
      return Array.from({ length: 11 }, (_, i) => (i + 0).toString());
    }

    return [];
  }, [question]);

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
    accepted: {
      label: "is accepted",
      values: null,
      unique: true,
    },
    clicked: {
      label: "is clicked",
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
    uploaded: {
      label: "has uploaded file",
      values: null,
      unique: true,
    },
    notUploaded: {
      label: "has not uploaded file",
      values: null,
      unique: true,
    },
    booked: {
      label: "has a call booked",
      values: null,
      unique: true,
    },
    isCompletelySubmitted: {
      label: "is completely submitted",
      values: null,
      unique: true,
    },
    isPartiallySubmitted: {
      label: "is partially submitted",
      values: null,
      unique: true,
    },
  };

  const addLogic = () => {
    if (question.logic && question.logic?.length >= 0) {
      const hasUndefinedLogic = question.logic.some(
        (logic) =>
          logic.condition === undefined && logic.value === undefined && logic.destination === undefined
      );
      if (hasUndefinedLogic) {
        toast("Please fill current logic jumps first.", {
          icon: "🤓",
        });
        return;
      }
    }

    const newLogic: TSurveyLogic[] = !question.logic ? [] : question.logic;
    newLogic.push({
      condition: undefined,
      value: undefined,
      destination: undefined,
    });
    updateQuestion(questionIdx, { logic: newLogic });
  };

  const updateLogic = (logicIdx: number, updatedAttributes: any) => {
    const currentLogic: any = question.logic ? question.logic[logicIdx] : undefined;
    if (!currentLogic) return;

    // clean logic value if not needed or if condition changed between multiSelect and singleSelect conditions
    const updatedCondition = updatedAttributes?.condition;
    const currentCondition = currentLogic?.condition;
    const updatedLogicCondition = logicConditions[updatedCondition];
    const currentLogicCondition = logicConditions[currentCondition];
    if (updatedCondition) {
      if (updatedLogicCondition?.multiSelect && !currentLogicCondition?.multiSelect) {
        updatedAttributes.value = [];
      } else if (
        (!updatedLogicCondition?.multiSelect && currentLogicCondition?.multiSelect) ||
        updatedLogicCondition?.values === null
      ) {
        updatedAttributes.value = undefined;
      }
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

  const updateMultiSelectLogic = (logicIdx: number, checked: boolean, value: string) => {
    const newLogic = !question.logic
      ? []
      : question.logic.map((logic, idx) => {
          if (idx === logicIdx) {
            const newValues = !logic.value ? [] : logic.value;
            if (checked) {
              newValues.push(value);
            } else {
              newValues.splice(newValues.indexOf(value), 1);
            }
            return { ...logic, value: Array.from(new Set(newValues)) };
          }
          return logic;
        });

    updateQuestion(questionIdx, { logic: newLogic });
  };

  const deleteLogic = (logicIdx: number) => {
    const updatedLogic = !question.logic ? [] : structuredClone(question.logic);
    updatedLogic.splice(logicIdx, 1);
    updateQuestion(questionIdx, { logic: updatedLogic });
  };

  if (!(question.type in conditions)) {
    return <></>;
  }

  const getLogicDisplayValue = (value: string | string[]): string => {
    if (question.type === "pictureSelection") {
      if (Array.isArray(value)) {
        return value
          .map((val) => {
            const choiceIndex = question.choices.findIndex((choice) => choice.id === val);
            return `Picture ${choiceIndex + 1}`;
          })
          .join(", ");
      } else {
        const choiceIndex = question.choices.findIndex((choice) => choice.id === value);
        return `Picture ${choiceIndex + 1}`;
      }
    } else if (Array.isArray(value)) {
      return value.join(", ");
    }
    return value;
  };

  const getOptionPreview = (value: string) => {
    if (question.type === "pictureSelection") {
      const choice = question.choices.find((choice) => choice.id === value);
      if (choice) {
        return <Image src={choice.imageUrl} alt={"Picture"} width={20} height={12} className="rounded-xs" />;
      }
    }
  };

  return (
    <div className="mt-3">
      <Label>Logic Jumps</Label>

      {question?.logic && question?.logic?.length !== 0 && (
        <div className="mt-2 space-y-3">
          {question?.logic?.map((logic, logicIdx) => (
            <div key={logicIdx} className="flex items-center space-x-2 space-y-1 text-xs xl:text-sm">
              <div>
                <CornerDownRightIcon className="h-4 w-4" />
              </div>
              <p className="text-slate-800">If this answer</p>

              <Select value={logic.condition} onValueChange={(e) => updateLogic(logicIdx, { condition: e })}>
                <SelectTrigger className="min-w-fit flex-1">
                  <SelectValue placeholder="Select condition" className="text-xs lg:text-sm" />
                </SelectTrigger>
                <SelectContent>
                  {conditions[question.type].map(
                    (condition) =>
                      !(question.required && (condition === "skipped" || condition === "notUploaded")) && (
                        <SelectItem
                          key={condition}
                          value={condition}
                          title={logicConditions[condition].label}
                          className="text-xs lg:text-sm">
                          {logicConditions[condition].label}
                        </SelectItem>
                      )
                  )}
                </SelectContent>
              </Select>

              {logic.condition && logicConditions[logic.condition].values != null && (
                <DropdownMenu>
                  <DropdownMenuTrigger className="z-10 cursor-pointer" asChild>
                    <div className="flex h-10 w-full items-center justify-between overflow-hidden rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                      {!logic.value || logic.value?.length === 0 ? (
                        <p className="line-clamp-1 text-slate-400" title="Select match type">
                          Select match type
                        </p>
                      ) : (
                        <p className="line-clamp-1" title={getLogicDisplayValue(logic.value)}>
                          {getLogicDisplayValue(logic.value)}
                        </p>
                      )}
                      <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                    </div>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    className="w-40 bg-slate-50 text-slate-700"
                    align="start"
                    side="bottom">
                    {showDropdownSearch && (
                      <Input
                        autoFocus
                        placeholder="Search options"
                        className="mb-1 w-full bg-white"
                        onChange={(e) => setSearchValue(e.target.value)}
                        value={searchValue}
                        onKeyDown={(e) => e.stopPropagation()}
                      />
                    )}
                    <div className="max-h-72 overflow-y-auto overflow-x-hidden">
                      {logicConditions[logic.condition].values
                        ?.filter((value) => value.includes(searchValue))
                        ?.map((value) => (
                          <DropdownMenuCheckboxItem
                            key={value}
                            title={value}
                            checked={
                              !logicConditions[logic.condition].multiSelect
                                ? logic.value === value
                                : logic.value?.includes(value)
                            }
                            onSelect={(e) => e.preventDefault()}
                            onCheckedChange={(e) =>
                              !logicConditions[logic.condition].multiSelect
                                ? updateLogic(logicIdx, { value })
                                : updateMultiSelectLogic(logicIdx, e, value)
                            }>
                            <div className="flex space-x-2">
                              {question.type === "pictureSelection" && getOptionPreview(value)}
                              <p>{getLogicDisplayValue(value)}</p>
                            </div>
                          </DropdownMenuCheckboxItem>
                        ))}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              <p className="text-slate-800">jump to</p>

              <Select
                value={logic.destination}
                onValueChange={(e) => updateLogic(logicIdx, { destination: e })}>
                <SelectTrigger className="w-fit overflow-hidden">
                  <SelectValue placeholder="Select question" />
                </SelectTrigger>
                <SelectContent>
                  {transformedSurvey.questions.map(
                    (question, idx) =>
                      idx !== questionIdx && (
                        <SelectItem
                          key={question.id}
                          value={question.id}
                          title={getLocalizedValue(question.headline, "default")}>
                          <div className="w-96">
                            <p className="truncate text-left">
                              {idx + 1}
                              {". "}
                              {getLocalizedValue(question.headline, "default")}
                            </p>
                          </div>
                        </SelectItem>
                      )
                  )}
                  {localSurvey.endings.map((ending) => {
                    return (
                      <SelectItem value={ending.id}>
                        {ending.type === "endScreen"
                          ? getLocalizedValue(ending.headline, "default")
                          : ending.label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <div>
                <TrashIcon
                  className="h-4 w-4 cursor-pointer text-slate-400"
                  onClick={() => deleteLogic(logicIdx)}
                />
              </div>
            </div>
          ))}
          <div className="flex flex-wrap items-center space-x-2 py-1 text-sm">
            <ArrowDownIcon className="h-4 w-4" />
            <p className="text-slate-700">All other answers will continue to the next question</p>
          </div>
        </div>
      )}

      <div className="mt-2 flex items-center space-x-2">
        <Button
          id="logicJumps"
          className="bg-slate-100 hover:bg-slate-50"
          type="button"
          name="logicJumps"
          size="sm"
          variant="secondary"
          StartIcon={SplitIcon}
          onClick={() => addLogic()}>
          Add Logic
        </Button>
        <TooltipProvider delayDuration={50}>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="ml-2 inline h-4 w-4 cursor-default text-slate-500" />
            </TooltipTrigger>
            <TooltipContent className="max-w-[300px]" side="top">
              With logic jumps you can skip questions based on the responses users give.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
};
