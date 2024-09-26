import { actionObjectiveOptions } from "@/app/(app)/(survey-editor)/environments/[environmentId]/surveys/[surveyId]/edit/lib/utils";
import { CopyIcon, EllipsisVerticalIcon, PlusIcon, TrashIcon } from "lucide-react";
import React, { useEffect, useMemo } from "react";
import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { questionIconMapping } from "@formbricks/lib/utils/questions";
import {
  TActionNumberVariableCalculateOperator,
  TActionObjective,
  TActionTextVariableCalculateOperator,
  TActionVariableValueType,
  TSurvey,
  TSurveyLogicAction,
  TSurveyQuestion,
} from "@formbricks/types/surveys/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@formbricks/ui/DropdownMenu";
import { InputCombobox, TComboboxOption } from "@formbricks/ui/InputCombobox";

interface LogicEditorActionProps {
  action: TSurveyLogicAction;
  actionIdx: number;
  handleObjectiveChange: (actionIdx: number, val: TActionObjective) => void;
  handleValuesChange: (actionIdx: number, values: any) => void;
  handleActionsChange: (operation: "remove" | "addBelow" | "duplicate", actionIdx: number) => void;
  isRemoveDisabled: boolean;
  filteredQuestions: TSurveyQuestion[];
  endings: TSurvey["endings"];
}

const _LogicEditorAction = ({
  action,
  actionIdx,
  handleActionsChange,
  handleObjectiveChange,
  handleValuesChange,
  isRemoveDisabled,
  filteredQuestions,
  endings,
}: LogicEditorActionProps) => {
  useEffect(() => {
    console.log("action changed");
  }, [action]);
  useEffect(() => {
    console.log("filteredQuestions changed");
  }, [filteredQuestions]);
  useEffect(() => {
    console.log("endings changed");
  }, [endings]);
  useEffect(() => {
    console.log("isRemoveDisabled changed");
  }, [isRemoveDisabled]);
  useEffect(() => {
    console.log("actionIdx changed");
  }, [actionIdx]);
  useEffect(() => {
    console.log("handleActionsChange changed");
  }, [handleActionsChange]);
  useEffect(() => {
    console.log("handleObjectiveChange changed");
  }, [handleObjectiveChange]);
  useEffect(() => {
    console.log("handleValuesChange changed");
  }, [handleValuesChange]);

  const actionTargetOptions = useMemo((): TComboboxOption[] => {
    // let questions = localSurvey.questions.filter((_, idx) => idx !== questionIdx);
    let questions = [...filteredQuestions];

    if (action.objective === "requireAnswer") {
      questions = questions.filter((question) => !question.required);
    }

    const questionOptions = questions.map((question) => {
      return {
        icon: questionIconMapping[question.type],
        label: getLocalizedValue(question.headline, "default"),
        value: question.id,
      };
    });

    if (action.objective === "requireAnswer") return questionOptions;

    const endingCardOptions = endings.map((ending) => {
      return {
        label:
          ending.type === "endScreen"
            ? getLocalizedValue(ending.headline, "default") || "End Screen"
            : ending.label || "Redirect Thank you card",
        value: ending.id,
      };
    });

    return [...questionOptions, ...endingCardOptions];
  }, [action.objective, JSON.stringify(filteredQuestions), endings]);

  return (
    <div key={action.id} className="flex grow items-center justify-between gap-x-2">
      <div className="block w-9 shrink-0">{actionIdx === 0 ? "Then" : "and"}</div>
      <div className="flex grow items-center gap-x-2">
        <InputCombobox
          id={`action-${actionIdx}-objective`}
          key={`objective-${action.id}`}
          showSearch={false}
          options={actionObjectiveOptions}
          value={action.objective}
          onChangeValue={(val: TActionObjective) => {
            handleObjectiveChange(actionIdx, val);
          }}
          comboboxClasses="grow"
        />
        {action.objective !== "calculate" && (
          <InputCombobox
            id={`action-${actionIdx}-target`}
            key={`target-${action.id}`}
            showSearch={false}
            options={actionTargetOptions}
            value={action.target}
            onChangeValue={(val: string) => {
              handleValuesChange(actionIdx, {
                target: val,
              });
            }}
            comboboxClasses="grow"
          />
        )}
        {/* {action.objective === "calculate" && (
          <>
            <InputCombobox
              id={`action-${actionIdx}-variableId`}
              key={`variableId-${action.id}`}
              showSearch={false}
              options={getActionVariableOptions(localSurvey)}
              value={action.variableId}
              onChangeValue={(val: string) => {
                handleValuesChange(actionIdx, {
                  variableId: val,
                  value: {
                    type: "static",
                    value: "",
                  },
                });
              }}
              comboboxClasses="grow"
              emptyDropdownText="Add a variable to calculate"
            />
            <InputCombobox
              id={`action-${actionIdx}-operator`}
              key={`operator-${action.id}`}
              showSearch={false}
              options={getActionOperatorOptions(
                localSurvey.variables.find((v) => v.id === action.variableId)?.type
              )}
              value={action.operator}
              onChangeValue={(
                val: TActionTextVariableCalculateOperator | TActionNumberVariableCalculateOperator
              ) => {
                handleValuesChange(actionIdx, {
                  operator: val,
                });
              }}
              comboboxClasses="grow"
            />
            <InputCombobox
              id={`action-${actionIdx}-value`}
              key={`value-${action.id}`}
              withInput={true}
              clearable={true}
              value={action.value?.value ?? ""}
              inputProps={{
                placeholder: "Value",
                type: localSurvey.variables.find((v) => v.id === action.variableId)?.type || "text",
              }}
              groupedOptions={getActionValueOptions(action.variableId, localSurvey)}
              onChangeValue={(val, option, fromInput) => {
                const fieldType = option?.meta?.type as TActionVariableValueType;

                if (!fromInput && fieldType !== "static") {
                  handleValuesChange(actionIdx, {
                    value: {
                      type: fieldType,
                      value: val as string,
                    },
                  });
                } else if (fromInput) {
                  handleValuesChange(actionIdx, {
                    value: {
                      type: "static",
                      value: val as string,
                    },
                  });
                }
              }}
              comboboxClasses="grow shrink-0"
            />
          </>
        )} */}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger id={`actions-${actionIdx}-dropdown`}>
          <EllipsisVerticalIcon className="h-4 w-4 text-slate-700 hover:text-slate-950" />
        </DropdownMenuTrigger>

        <DropdownMenuContent>
          <DropdownMenuItem
            className="flex items-center gap-2"
            onClick={() => {
              handleActionsChange("addBelow", actionIdx);
            }}>
            <PlusIcon className="h-4 w-4" />
            Add action below
          </DropdownMenuItem>

          <DropdownMenuItem
            className="flex items-center gap-2"
            disabled={isRemoveDisabled}
            onClick={() => {
              handleActionsChange("remove", actionIdx);
            }}>
            <TrashIcon className="h-4 w-4" />
            Remove
          </DropdownMenuItem>

          <DropdownMenuItem
            className="flex items-center gap-2"
            onClick={() => {
              handleActionsChange("duplicate", actionIdx);
            }}>
            <CopyIcon className="h-4 w-4" />
            Duplicate
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export const LogicEditorAction = React.memo(_LogicEditorAction);
