import {
  actionObjectiveOptions,
  getActionOperatorOptions,
} from "@/app/(app)/(survey-editor)/environments/[environmentId]/surveys/[surveyId]/edit/lib/utils";
import {
  CopyIcon,
  EllipsisVerticalIcon,
  EyeOffIcon,
  FileDigitIcon,
  FileType2Icon,
  PlusIcon,
  TrashIcon,
} from "lucide-react";
import React, { useCallback, useMemo } from "react";
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
  TSurveyQuestionTypeEnum,
} from "@formbricks/types/surveys/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@formbricks/ui/DropdownMenu";
import { InputCombobox, TComboboxGroupedOption, TComboboxOption } from "@formbricks/ui/InputCombobox";

interface LogicEditorActionProps {
  action: TSurveyLogicAction;
  actionIdx: number;
  handleObjectiveChange: (actionIdx: number, val: TActionObjective) => void;
  handleValuesChange: (actionIdx: number, values: any) => void;
  handleActionsChange: (operation: "remove" | "addBelow" | "duplicate", actionIdx: number) => void;
  isRemoveDisabled: boolean;
  questions: TSurveyQuestion[];
  endings: TSurvey["endings"];
  variables: TSurvey["variables"];
  questionIdx: number;
  hiddenFields: {
    enabled: boolean;
    fieldIds?: string[] | undefined;
  };
}

const _LogicEditorAction = ({
  action,
  actionIdx,
  handleActionsChange,
  handleObjectiveChange,
  handleValuesChange,
  isRemoveDisabled,
  questions,
  endings,
  variables,
  questionIdx,
  hiddenFields,
}: LogicEditorActionProps) => {
  const actionTargetOptions = useMemo((): TComboboxOption[] => {
    let filteredQuestions = questions.filter((_, idx) => idx !== questionIdx);

    if (action.objective === "requireAnswer") {
      filteredQuestions = filteredQuestions.filter((question) => !question.required);
    }

    const questionOptions = filteredQuestions.map((question) => {
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
  }, [action.objective, endings, questionIdx, questions]);

  const actionVariableOptions = useMemo((): TComboboxOption[] => {
    return variables.map((variable) => {
      return {
        icon: variable.type === "number" ? FileDigitIcon : FileType2Icon,
        label: variable.name,
        value: variable.id,
        meta: {
          variableType: variable.type,
        },
      };
    });
  }, [variables]);

  const getActionValueOptions = useCallback(
    (variableId: string): TComboboxGroupedOption[] => {
      const hiddenFieldIds = hiddenFields?.fieldIds ?? [];

      const hiddenFieldsOptions = hiddenFieldIds.map((field) => {
        return {
          icon: EyeOffIcon,
          label: field,
          value: field,
          meta: {
            type: "hiddenField",
          },
        };
      });

      const selectedVariable = variables.find((variable) => variable.id === variableId);
      const filteredVariables = variables.filter((variable) => variable.id !== variableId);

      if (!selectedVariable) return [];

      if (selectedVariable.type === "text") {
        const allowedQuestions = questions.filter((question) =>
          [
            TSurveyQuestionTypeEnum.OpenText,
            TSurveyQuestionTypeEnum.MultipleChoiceSingle,
            TSurveyQuestionTypeEnum.Rating,
            TSurveyQuestionTypeEnum.NPS,
            TSurveyQuestionTypeEnum.Date,
          ].includes(question.type)
        );

        const questionOptions = allowedQuestions.map((question) => {
          return {
            icon: questionIconMapping[question.type],
            label: getLocalizedValue(question.headline, "default"),
            value: question.id,
            meta: {
              type: "question",
            },
          };
        });

        const stringVariables = filteredVariables.filter((variable) => variable.type === "text");
        const variableOptions = stringVariables.map((variable) => {
          return {
            icon: FileType2Icon,
            label: variable.name,
            value: variable.id,
            meta: {
              type: "variable",
            },
          };
        });

        const groupedOptions: TComboboxGroupedOption[] = [];

        if (questionOptions.length > 0) {
          groupedOptions.push({
            label: "Questions",
            value: "questions",
            options: questionOptions,
          });
        }

        if (variableOptions.length > 0) {
          groupedOptions.push({
            label: "Variables",
            value: "variables",
            options: variableOptions,
          });
        }

        if (hiddenFieldsOptions.length > 0) {
          groupedOptions.push({
            label: "Hidden Fields",
            value: "hiddenFields",
            options: hiddenFieldsOptions,
          });
        }

        return groupedOptions;
      } else if (selectedVariable.type === "number") {
        const allowedQuestions = questions.filter((question) =>
          [TSurveyQuestionTypeEnum.Rating, TSurveyQuestionTypeEnum.NPS].includes(question.type)
        );

        const questionOptions = allowedQuestions.map((question) => {
          return {
            icon: questionIconMapping[question.type],
            label: getLocalizedValue(question.headline, "default"),
            value: question.id,
            meta: {
              type: "question",
            },
          };
        });

        const numberVariables = filteredVariables.filter((variable) => variable.type === "number");
        const variableOptions = numberVariables.map((variable) => {
          return {
            icon: FileDigitIcon,
            label: variable.name,
            value: variable.id,
            meta: {
              type: "variable",
            },
          };
        });

        const groupedOptions: TComboboxGroupedOption[] = [];

        if (questionOptions.length > 0) {
          groupedOptions.push({
            label: "Questions",
            value: "questions",
            options: questionOptions,
          });
        }

        if (variableOptions.length > 0) {
          groupedOptions.push({
            label: "Variables",
            value: "variables",
            options: variableOptions,
          });
        }

        if (hiddenFieldsOptions.length > 0) {
          groupedOptions.push({
            label: "Hidden Fields",
            value: "hiddenFields",
            options: hiddenFieldsOptions,
          });
        }

        return groupedOptions;
      }

      return [];
    },
    [hiddenFields?.fieldIds, questions, variables]
  );

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
        {action.objective === "calculate" && (
          <>
            <InputCombobox
              id={`action-${actionIdx}-variableId`}
              key={`variableId-${action.id}`}
              showSearch={false}
              options={actionVariableOptions}
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
              options={getActionOperatorOptions(variables.find((v) => v.id === action.variableId)?.type)}
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
                type: variables.find((v) => v.id === action.variableId)?.type || "text",
              }}
              groupedOptions={getActionValueOptions(action.variableId)}
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
        )}
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
