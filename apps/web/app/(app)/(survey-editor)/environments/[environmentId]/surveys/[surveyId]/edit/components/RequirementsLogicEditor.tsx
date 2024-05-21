import {
  ArrowDownIcon,
  ChevronDown,
  CornerDownRightIcon,
  HelpCircle,
  SplitIcon,
  TrashIcon,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "react-hot-toast";

import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { structuredClone } from "@formbricks/lib/pollyfills/structuredClone";
import { checkForRecallInHeadline } from "@formbricks/lib/utils/recall";
import {
  TSurvey,
  TSurveyLogic,
  TSurveyLogicCondition,
  TSurveyQuestion,
  TSurveyQuestionType,
  TSurveyRequirementsLogic,
} from "@formbricks/types/surveys";
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

type ElementType<T extends any> = T extends Iterable<infer E> ? E : never;

interface RequirementsLogicItemProps {
  logic: ElementType<TSurveyQuestion["requirementsLogic"]>;
  localSurvey: TSurvey;
  questionIdx: number;
  question: TSurveyQuestion;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  updateLogic: (updatedAttributes: any) => void;
  handleDelete?: () => void;
}

const VALID_CONDITIONS = {
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
  pictureSelection: ["submitted", "skipped"],
  fileUpload: ["uploaded", "notUploaded"],
  cal: ["skipped", "booked"],
  matrix: ["isCompletelySubmitted", "isPartiallySubmitted", "skipped"],
  address: ["submitted", "skipped"],
};

export const RequirementsLogicItem = (props: RequirementsLogicItemProps) => {
  const { logic, localSurvey, updateLogic, question, handleDelete } = props;
  const [searchValue, setSearchValue] = useState<string>("");

  const sourceQuestion = useMemo(
    () => localSurvey.questions.find((q) => q.id === logic.source),
    [localSurvey.questions, logic.source]
  );

  const sourceQuestionValues = useMemo(() => {
    if (!sourceQuestion) return [];

    if ("choices" in sourceQuestion) {
      return sourceQuestion.choices.map((choice) => getLocalizedValue(choice.label, "default"));
    } else if ("range" in sourceQuestion) {
      return Array.from({ length: sourceQuestion.range ? sourceQuestion.range : 0 }, (_, i) =>
        (i + 1).toString()
      );
    } else if (sourceQuestion.type === TSurveyQuestionType.NPS) {
      return Array.from({ length: 11 }, (_, i) => (i + 0).toString());
    }
    return [];
  }, [sourceQuestion]);

  const logicConditions: LogicConditions = useMemo(() => {
    return {
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
        values: sourceQuestionValues,
      },
      notEquals: {
        label: "does not equal",
        values: sourceQuestionValues,
      },
      lessThan: {
        label: "is less than",
        values: sourceQuestionValues,
      },
      lessEqual: {
        label: "is less or equal to",
        values: sourceQuestionValues,
      },
      greaterThan: {
        label: "is greater than",
        values: sourceQuestionValues,
      },
      greaterEqual: {
        label: "is greater or equal to",
        values: sourceQuestionValues,
      },
      includesAll: {
        label: "includes all of",
        values: sourceQuestionValues,
        multiSelect: true,
      },
      includesOne: {
        label: "includes one of",
        values: sourceQuestionValues,
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
  }, [sourceQuestionValues]);

  const logicValueFilteredOptions = useMemo(() => {
    if (!logic.condition) return;
    return logicConditions[logic.condition].values?.filter((value) => value.includes(searchValue));
  }, [logic.condition, logicConditions, searchValue]);

  const handleUpdateMultiSelectValue = useCallback(
    (checked: boolean, value: string) => {
      let newValues = !logic.value ? [] : logic.value;
      if (!Array.isArray(newValues)) {
        newValues = [newValues];
      }

      if (checked) {
        newValues.push(value);
      } else {
        newValues.splice(newValues.indexOf(value), 1);
      }

      updateLogic({ value: newValues });
    },
    [logic.value, updateLogic]
  );

  const getLogicDisplayValue = (value: string | string[]) => {
    if (Array.isArray(value)) {
      return value.join(", ");
    }
    return value;
  };

  return (
    <div className="flex items-center space-x-2 space-y-1 text-xs xl:text-sm">
      <CornerDownRightIcon className="h-4 w-4" />

      {/* Select Question source */}
      <Select value={logic.source} onValueChange={(e) => updateLogic({ source: e })}>
        <SelectTrigger className="w-fit overflow-hidden ">
          <SelectValue placeholder="Select question" />
        </SelectTrigger>
        <SelectContent>
          {localSurvey.questions.map(
            (q, idx) =>
              q.id !== question.id && (
                <SelectItem key={q.id} value={q.id} title={getLocalizedValue(q.headline, "default")}>
                  <div className="w-40">
                    <p className="truncate text-left">{getLocalizedValue(q.headline, "default")}</p>
                  </div>
                </SelectItem>
              )
          )}
        </SelectContent>
      </Select>

      {/* Select condition */}
      <Select
        disabled={!logic.source}
        value={logic.condition}
        onValueChange={(e) => updateLogic({ condition: e })}>
        <SelectTrigger className=" min-w-fit flex-1">
          <SelectValue placeholder="Select condition" className="text-xs lg:text-sm" />
        </SelectTrigger>
        <SelectContent>
          {sourceQuestion &&
            logicConditions &&
            VALID_CONDITIONS[sourceQuestion.type].map(
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

      {/* Select value */}
      {logic.condition && logicConditions && logicConditions[logic.condition].values != null && (
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
          <DropdownMenuContent className="w-40 bg-slate-50 text-slate-700" align="start" side="bottom">
            <Input
              autoFocus
              placeholder="Search options"
              className="mb-1 w-full bg-white"
              onChange={(e) => setSearchValue(e.target.value)}
              value={searchValue}
              onKeyDown={(e) => e.stopPropagation()}
            />
            <div className="max-h-72 overflow-y-auto overflow-x-hidden">
              {logicValueFilteredOptions?.map(
                (value) =>
                  logic.condition !== undefined && (
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
                        !logicConditions[logic.condition as any].multiSelect
                          ? updateLogic({ value })
                          : handleUpdateMultiSelectValue(e, value)
                      }>
                      {value}
                    </DropdownMenuCheckboxItem>
                  )
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {handleDelete && <TrashIcon className="h-4 w-4 cursor-pointer text-slate-400" onClick={handleDelete} />}
    </div>
  );
};

interface RequirementsLogicEditorProps {
  localSurvey: TSurvey;
  questionIdx: number;
  question: TSurveyQuestion;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
}

type LogicConditions = {
  [K in TSurveyLogicCondition]: {
    label: string;
    values: string[] | null;
    unique?: boolean;
    multiSelect?: boolean;
  };
};

export const RequirementsLogicEditor = ({
  localSurvey,
  question,
  questionIdx,
  updateQuestion,
}: RequirementsLogicEditorProps) => {
  localSurvey = useMemo(() => {
    return checkForRecallInHeadline(localSurvey, "default");
  }, [localSurvey]);

  const addLogic = () => {
    if (question.requirementsLogic && question.requirementsLogic?.length >= 0) {
      const hasUndefinedLogic = question.requirementsLogic.some(
        (logic) => logic.condition === undefined && logic.value === undefined && logic.source === undefined
      );
      if (hasUndefinedLogic) {
        console.error("Please fill previus reuirement first.");
        toast("Please fill previus reuirement first.", {
          icon: "🤓",
        });
        return;
      }
    }

    const newLogic: TSurveyRequirementsLogic[] = !question.requirementsLogic
      ? []
      : question.requirementsLogic;
    newLogic.push({
      condition: undefined,
      value: undefined,
      source: undefined,
    });
    updateQuestion(questionIdx, { requirementsLogic: newLogic });
  };

  const updateLogic = (logicIdx: number, updatedAttributes: any) => {
    const currentLogic: any = question.requirementsLogic ? question.requirementsLogic[logicIdx] : undefined;
    if (!currentLogic) return;

    const newLogic = !question.requirementsLogic
      ? []
      : question.requirementsLogic.map((logic, idx) => {
          if (idx === logicIdx) {
            return { ...logic, ...updatedAttributes };
          }
          return logic;
        });

    updateQuestion(questionIdx, { requirementsLogic: newLogic });
  };

  const deleteLogic = (logicIdx: number) => {
    const updatedLogic = !question.requirementsLogic ? [] : structuredClone(question.requirementsLogic);
    updatedLogic.splice(logicIdx, 1);
    updateQuestion(questionIdx, { requirementsLogic: updatedLogic });
  };

  return (
    <div className="mt-3">
      <Label>Requirements Logic</Label>

      {question?.requirementsLogic && question?.requirementsLogic?.length !== 0 ? (
        question?.requirementsLogic.map((logic, logicIdx) => (
          <RequirementsLogicItem
            key={logicIdx}
            logic={logic}
            localSurvey={localSurvey}
            questionIdx={questionIdx}
            question={question}
            updateQuestion={updateQuestion}
            updateLogic={(updatedAttributes) => updateLogic(logicIdx, updatedAttributes)}
            handleDelete={() => deleteLogic(logicIdx)}
          />
        ))
      ) : (
        <div className="flex flex-wrap items-center space-x-2 py-1 text-sm">
          <ArrowDownIcon className="h-4 w-4" />
          <p className="text-slate-700">
            This question is displayed without any requirements based on previous responses.
          </p>
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
          Add Requirement
        </Button>
        <TooltipProvider delayDuration={50}>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="ml-2 inline h-4 w-4 cursor-default text-slate-500" />
            </TooltipTrigger>
            <TooltipContent className="max-w-[300px]" side="top">
              With requirements logic, you can configure a question to appear only if the user has provided a
              specific answer to previous questions.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
};
