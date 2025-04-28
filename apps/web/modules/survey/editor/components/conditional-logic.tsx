"use client";

import { duplicateLogicItem } from "@/lib/surveyLogic/utils";
import { replaceHeadlineRecall } from "@/lib/utils/recall";
import { LogicEditor } from "@/modules/survey/editor/components/logic-editor";
import {
  getDefaultOperatorForQuestion,
  replaceEndingCardHeadlineRecall,
} from "@/modules/survey/editor/lib/utils";
import { Button } from "@/modules/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { Label } from "@/modules/ui/components/label";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { createId } from "@paralleldrive/cuid2";
import { useTranslate } from "@tolgee/react";
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
import { TSurvey, TSurveyLogic, TSurveyQuestion } from "@formbricks/types/surveys/types";

interface ConditionalLogicProps {
  localSurvey: TSurvey;
  questionIdx: number;
  question: TSurveyQuestion;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
}

export function ConditionalLogic({
  localSurvey,
  question,
  questionIdx,
  updateQuestion,
}: ConditionalLogicProps) {
  // [UseTusk]

  const { t } = useTranslate();
  const transformedSurvey = useMemo(() => {
    let modifiedSurvey = replaceHeadlineRecall(localSurvey, "default");
    modifiedSurvey = replaceEndingCardHeadlineRecall(modifiedSurvey, "default");

    return modifiedSurvey;
  }, [localSurvey]);

  const addLogic = () => {
    const operator = getDefaultOperatorForQuestion(question, t);

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
    const isLast = logicCopy.length === 1;
    logicCopy.splice(logicItemIdx, 1);

    updateQuestion(questionIdx, {
      logic: logicCopy,
      logicFallback: isLast ? undefined : question.logicFallback,
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
  const [parent] = useAutoAnimate();

  return (
    <div className="mt-4" ref={parent}>
      <Label className="flex gap-2">
        {t("environments.surveys.edit.conditional_logic")}
        <SplitIcon className="h-4 w-4 rotate-90" />
      </Label>

      {question.logic && question.logic.length > 0 && (
        <div className="mt-2 flex flex-col gap-4" ref={parent}>
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
                    {t("common.duplicate")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={logicItemIdx === 0}
                    onClick={() => {
                      moveLogic(logicItemIdx, logicItemIdx - 1);
                    }}
                    icon={<ArrowUpIcon className="h-4 w-4" />}>
                    {t("common.move_up")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={logicItemIdx === (question.logic ?? []).length - 1}
                    onClick={() => {
                      moveLogic(logicItemIdx, logicItemIdx + 1);
                    }}
                    icon={<ArrowDownIcon className="h-4 w-4" />}>
                    {t("common.move_down")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      handleRemoveLogic(logicItemIdx);
                    }}
                    icon={<TrashIcon className="h-4 w-4" />}>
                    {t("common.remove")}
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
          type="button"
          name="logicJumps"
          size="sm"
          variant="secondary"
          onClick={addLogic}>
          {t("environments.surveys.edit.add_logic")}
          <PlusIcon />
        </Button>
      </div>
    </div>
  );
}
