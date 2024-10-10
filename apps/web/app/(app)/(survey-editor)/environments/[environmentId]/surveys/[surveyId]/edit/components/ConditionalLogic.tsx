import { LogicEditor } from "@/app/(app)/(survey-editor)/environments/[environmentId]/surveys/[surveyId]/edit/components/LogicEditor";
import {
  getDefaultOperatorForQuestion,
  replaceEndingCardHeadlineRecall,
} from "@/app/(app)/(survey-editor)/environments/[environmentId]/surveys/[surveyId]/edit/lib/utils";
import { createId } from "@paralleldrive/cuid2";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CopyIcon,
  EllipsisVerticalIcon,
  PlusIcon,
  SplitIcon,
  TrashIcon,
} from "lucide-react";
import { useMemo } from "react";
import { duplicateLogicItem } from "@formbricks/lib/surveyLogic/utils";
import { replaceHeadlineRecall } from "@formbricks/lib/utils/recall";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import { TSurvey, TSurveyLogic, TSurveyQuestion } from "@formbricks/types/surveys/types";
import { Button } from "@formbricks/ui/components/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@formbricks/ui/components/DropdownMenu";
import { Label } from "@formbricks/ui/components/Label";

interface ConditionalLogicProps {
  localSurvey: TSurvey;
  questionIdx: number;
  question: TSurveyQuestion;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  attributeClasses: TAttributeClass[];
}

export function ConditionalLogic({
  attributeClasses,
  localSurvey,
  question,
  questionIdx,
  updateQuestion,
}: ConditionalLogicProps) {
  const transformedSurvey = useMemo(() => {
    let modifiedSurvey = replaceHeadlineRecall(localSurvey, "default", attributeClasses);
    modifiedSurvey = replaceEndingCardHeadlineRecall(modifiedSurvey, "default", attributeClasses);

    return modifiedSurvey;
  }, [localSurvey, attributeClasses]);

  const addLogic = () => {
    const operator = getDefaultOperatorForQuestion(question);

    const initialCondition: TSurveyLogic = {
      id: createId(),
      conditions: {
        id: createId(),
        connector: "and",
        conditions: [
          {
            id: createId(),
            leftOperand: {
              value: question.id,
              type: "question",
            },
            operator,
          },
        ],
      },
      actions: [
        {
          id: createId(),
          objective: "jumpToQuestion",
          target: "",
        },
      ],
    };

    updateQuestion(questionIdx, {
      logic: [...(question?.logic ?? []), initialCondition],
    });
  };

  const handleRemoveLogic = (logicItemIdx: number) => {
    const logicCopy = structuredClone(question.logic ?? []);
    logicCopy.splice(logicItemIdx, 1);

    updateQuestion(questionIdx, {
      logic: logicCopy,
    });
  };

  const moveLogic = (from: number, to: number) => {
    const logicCopy = structuredClone(question.logic ?? []);
    const [movedItem] = logicCopy.splice(from, 1);
    logicCopy.splice(to, 0, movedItem);

    updateQuestion(questionIdx, {
      logic: logicCopy,
    });
  };

  const duplicateLogic = (logicItemIdx: number) => {
    const logicCopy = structuredClone(question.logic ?? []);
    const logicItem = logicCopy[logicItemIdx];
    const newLogicItem = duplicateLogicItem(logicItem);
    logicCopy.splice(logicItemIdx + 1, 0, newLogicItem);

    updateQuestion(questionIdx, {
      logic: logicCopy,
    });
  };

  return (
    <div className="mt-2">
      <Label className="flex gap-2">
        Conditional Logic
        <SplitIcon className="h-4 w-4 rotate-90" />
      </Label>

      {question.logic && question.logic.length > 0 && (
        <div className="mt-2 flex flex-col gap-4">
          {question.logic.map((logicItem, logicItemIdx) => (
            <div
              key={logicItem.id}
              className="flex w-full grow items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <LogicEditor
                localSurvey={transformedSurvey}
                logicItem={logicItem}
                updateQuestion={updateQuestion}
                question={question}
                questionIdx={questionIdx}
                logicIdx={logicItemIdx}
                isLast={logicItemIdx === (question.logic ?? []).length - 1}
              />

              <DropdownMenu>
                <DropdownMenuTrigger>
                  <EllipsisVerticalIcon className="h-4 w-4 text-slate-700 hover:text-slate-950" />
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem
                    onClick={() => {
                      duplicateLogic(logicItemIdx);
                    }}
                    icon={<CopyIcon className="h-4 w-4" />}>
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={logicItemIdx === 0}
                    onClick={() => {
                      moveLogic(logicItemIdx, logicItemIdx - 1);
                    }}
                    icon={<ArrowUpIcon className="h-4 w-4" />}>
                    Move up
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={logicItemIdx === (question.logic ?? []).length - 1}
                    onClick={() => {
                      moveLogic(logicItemIdx, logicItemIdx + 1);
                    }}
                    icon={<ArrowDownIcon className="h-4 w-4" />}>
                    Move down
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      handleRemoveLogic(logicItemIdx);
                    }}
                    icon={<TrashIcon className="h-4 w-4" />}>
                    Remove
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
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
          EndIcon={PlusIcon}
          onClick={addLogic}>
          Add logic
        </Button>
      </div>
    </div>
  );
}
