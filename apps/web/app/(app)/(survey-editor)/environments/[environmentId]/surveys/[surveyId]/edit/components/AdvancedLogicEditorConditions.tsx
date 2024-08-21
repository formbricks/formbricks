import { createId } from "@paralleldrive/cuid2";
import { CopyIcon, MoreVerticalIcon, PlusIcon, Trash2Icon, WorkflowIcon } from "lucide-react";
import { cn } from "@formbricks/lib/cn";
import { performOperationsOnConditions } from "@formbricks/lib/survey/logic/utils";
import { TConditionBase, TSurveyAdvancedLogic } from "@formbricks/types/surveys/logic";
import { TSurveyQuestion } from "@formbricks/types/surveys/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@formbricks/ui/DropdownMenu";
import { Select, SelectContent, SelectTrigger } from "@formbricks/ui/Select";

interface AdvancedLogicEditorConditions {
  logicItem: TSurveyAdvancedLogic;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  question: TSurveyQuestion;
  questionIdx: number;
  logicIdx: number;
}

export function AdvancedLogicEditorConditions({
  logicItem,
  logicIdx,
  question,
  questionIdx,
  updateQuestion,
}: AdvancedLogicEditorConditions) {
  const conditions = logicItem.conditions;

  const handleAddConditionBelow = (resourceId: string, condition: TConditionBase) => {
    const advancedLogicCopy = structuredClone(question.advancedLogic);

    performOperationsOnConditions("addConditionBelow", advancedLogicCopy, logicIdx, resourceId, condition);

    updateQuestion(questionIdx, {
      advancedLogic: advancedLogicCopy,
    });
  };

  const handleConnectorChange = (resourceId: string, connector: TConditionBase["connector"]) => {
    if (!connector) return;
    console.log("onConnectorChange", resourceId, connector);
    const advancedLogicCopy = structuredClone(question.advancedLogic);

    performOperationsOnConditions("toggleConnector", advancedLogicCopy, logicIdx, resourceId, connector);

    updateQuestion(questionIdx, {
      advancedLogic: advancedLogicCopy,
    });
  };

  const handleRemoveCondition = (resourceId: string) => {
    const advancedLogicCopy = structuredClone(question.advancedLogic);

    performOperationsOnConditions("removeCondition", advancedLogicCopy, logicIdx, resourceId);

    updateQuestion(questionIdx, {
      advancedLogic: advancedLogicCopy,
    });
  };

  const handleDuplicateCondition = (resourceId: string) => {
    const advancedLogicCopy = structuredClone(question.advancedLogic);

    performOperationsOnConditions("duplicateCondition", advancedLogicCopy, logicIdx, resourceId);

    updateQuestion(questionIdx, {
      advancedLogic: advancedLogicCopy,
    });
  };

  const handleCreateGroup = (resourceId: string) => {
    const advancedLogicCopy = structuredClone(question.advancedLogic);

    performOperationsOnConditions("createGroup", advancedLogicCopy, logicIdx, resourceId);

    updateQuestion(questionIdx, {
      advancedLogic: advancedLogicCopy,
    });
  };

  console.log("conditions", conditions);

  return (
    <div className="flex flex-col gap-4 rounded-lg">
      {conditions.map((condition) => {
        const { connector, id, type } = condition;

        if (type === "group") {
          return (
            <div key={id} className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-2">
                <div className="mt-1 w-auto" key={connector}>
                  <span
                    className={cn(Boolean(connector) && "cursor-pointer underline", "text-sm")}
                    onClick={() => {
                      if (!connector) return;
                      handleConnectorChange(id, connector);
                    }}>
                    {connector ? connector : "When"}
                  </span>
                </div>
              </div>
              <div className="w-full rounded-lg border border-slate-200 bg-slate-100 p-4">
                <AdvancedLogicEditorConditions
                  key={id}
                  logicItem={condition}
                  updateQuestion={updateQuestion}
                  question={question}
                  questionIdx={questionIdx}
                  logicIdx={logicIdx}
                />
              </div>
              <div className="mt-1">
                <DropdownMenu key={`group-actions-${id}`}>
                  <DropdownMenuTrigger key={`group-actions-${id}`}>
                    <MoreVerticalIcon className="h-4 w-4" />
                  </DropdownMenuTrigger>

                  <DropdownMenuContent>
                    <DropdownMenuItem
                      className="flex items-center gap-2"
                      disabled={conditions.length === 1}
                      onClick={() => {
                        handleRemoveCondition(id);
                      }}>
                      <Trash2Icon className="h-4 w-4" />
                      Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          );
        }

        return (
          <div key={id} className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-2">
              <div className="w-auto" key={connector}>
                <span
                  className={cn(Boolean(connector) && "cursor-pointer underline", "text-sm")}
                  onClick={() => {
                    if (!connector) return;
                    handleConnectorChange(id, connector);
                  }}>
                  {connector ? connector : "When"}
                </span>
              </div>
            </div>
            <Select>
              <SelectTrigger></SelectTrigger>
              <SelectContent></SelectContent>
            </Select>
            <DropdownMenu>
              <DropdownMenuTrigger>
                <MoreVerticalIcon className="h-4 w-4" />
              </DropdownMenuTrigger>

              <DropdownMenuContent>
                <DropdownMenuItem
                  className="flex items-center gap-2"
                  onClick={() => {
                    handleAddConditionBelow(id, {
                      id: createId(),
                      connector: "and",
                    });
                  }}>
                  <PlusIcon className="h-4 w-4" />
                  Add condition below
                </DropdownMenuItem>

                <DropdownMenuItem
                  className="flex items-center gap-2"
                  disabled={conditions.length === 1}
                  onClick={() => {
                    handleRemoveCondition(id);
                  }}>
                  <Trash2Icon className="h-4 w-4" />
                  Remove
                </DropdownMenuItem>

                <DropdownMenuItem
                  className="flex items-center gap-2"
                  onClick={() => {
                    handleDuplicateCondition(id);
                  }}>
                  <CopyIcon className="h-4 w-4" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="flex items-center gap-2"
                  onClick={() => {
                    handleCreateGroup(id);
                  }}>
                  <WorkflowIcon className="h-4 w-4" />
                  Create group
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      })}
    </div>
  );
}
