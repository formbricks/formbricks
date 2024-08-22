import {
  getOpeartorOptions,
  getTargetOptions,
  getValueOptions,
} from "@/app/(app)/(survey-editor)/environments/[environmentId]/surveys/[surveyId]/edit/lib/util";
import { CopyIcon, CornerDownRightIcon, MoreVerticalIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useMemo } from "react";
import { actionObjectiveOptions } from "@formbricks/lib/survey/logic/utils";
import { replaceHeadlineRecall } from "@formbricks/lib/utils/recall";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import { TSurveyAdvancedLogic } from "@formbricks/types/surveys/logic";
import { TSurvey } from "@formbricks/types/surveys/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@formbricks/ui/DropdownMenu";
import { InputCombobox } from "@formbricks/ui/InputCombobox";

interface AdvancedLogicEditorActions {
  localSurvey: TSurvey;
  logicItem: TSurveyAdvancedLogic;
  handleActionsChange: (action: "delete" | "addBelow" | "duplicate", actionIdx: number) => void;
  hiddenFields: string[];
  userAttributes: string[];
  questionIdx: number;
  attributeClasses: TAttributeClass[];
}

export function AdvancedLogicEditorActions({
  localSurvey,
  logicItem,
  handleActionsChange,
  hiddenFields,
  userAttributes,
  questionIdx,
  attributeClasses,
}: AdvancedLogicEditorActions) {
  const actions = logicItem.actions;
  const transformedSurvey = useMemo(() => {
    return replaceHeadlineRecall(localSurvey, "default", attributeClasses);
  }, [localSurvey, attributeClasses]);

  return (
    <div className="">
      <div className="flex gap-2">
        <CornerDownRightIcon className="mt-2 h-5 w-5" />
        <div className="flex w-full flex-col gap-y-2">
          {actions.map((action, idx) => (
            <div className="flex w-full items-center justify-between gap-4">
              <span>{idx === 0 ? "Then" : "and"}</span>
              <div className="flex grow items-center gap-1">
                <InputCombobox
                  key="objective"
                  showSearch={false}
                  options={actionObjectiveOptions}
                  selected={action.objective}
                  onChangeValue={() => {}}
                  comboboxClasses="max-w-[200px]"
                />
                <InputCombobox
                  key="target"
                  showSearch={false}
                  options={getTargetOptions(transformedSurvey.questions, questionIdx)}
                  selected={action.objective}
                  onChangeValue={() => {}}
                  comboboxClasses="grow"
                />
                {action.objective === "calculate" && (
                  <>
                    <InputCombobox
                      key="attribute"
                      showSearch={false}
                      options={getOpeartorOptions(action.variableType)}
                      selected={action.operator}
                      onChangeValue={() => {}}
                    />
                    <InputCombobox
                      key="value"
                      withInput={true}
                      inputProps={{ placeholder: "Value" }}
                      groupedOptions={getValueOptions(
                        transformedSurvey.questions,
                        questionIdx,
                        hiddenFields,
                        userAttributes
                      )}
                      onChangeValue={() => {}}
                      comboboxClasses="flex"
                      comboboxSize="sm"
                    />
                  </>
                )}
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger>
                  <MoreVerticalIcon className="h-4 w-4" />
                </DropdownMenuTrigger>

                <DropdownMenuContent>
                  <DropdownMenuItem
                    className="flex items-center gap-2"
                    onClick={() => {
                      handleActionsChange("addBelow", idx);
                    }}>
                    <PlusIcon className="h-4 w-4" />
                    Add action below
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    className="flex items-center gap-2"
                    disabled={actions.length === 1}
                    onClick={() => {
                      handleActionsChange("delete", idx);
                    }}>
                    <Trash2Icon className="h-4 w-4" />
                    Remove
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    className="flex items-center gap-2"
                    onClick={() => {
                      handleActionsChange("duplicate", idx);
                    }}>
                    <CopyIcon className="h-4 w-4" />
                    Duplicate
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
