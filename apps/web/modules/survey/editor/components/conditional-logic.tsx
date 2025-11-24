"use client";

import { useAutoAnimate } from "@formkit/auto-animate/react";
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
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { TSurveyBlock, TSurveyBlockLogic } from "@formbricks/types/surveys/blocks";
import { TSurvey } from "@formbricks/types/surveys/types";
import { duplicateLogicItem } from "@/lib/surveyLogic/utils";
import { replaceHeadlineRecall } from "@/lib/utils/recall";
import { LogicEditor } from "@/modules/survey/editor/components/logic-editor";
import {
  getDefaultOperatorForElement,
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

interface ConditionalLogicProps {
  localSurvey: TSurvey;
  blockIdx: number;
  block: TSurveyBlock;
  updateBlockLogic: (blockIdx: number, logic: TSurveyBlockLogic[]) => void;
  updateBlockLogicFallback: (blockIdx: number, logicFallback: string | undefined) => void;
}

export function ConditionalLogic({
  localSurvey,
  blockIdx,
  block,
  updateBlockLogic,
  updateBlockLogicFallback,
}: ConditionalLogicProps) {
  const { t } = useTranslation();
  const transformedSurvey = useMemo(() => {
    let modifiedSurvey = replaceHeadlineRecall(localSurvey, "default");
    modifiedSurvey = replaceEndingCardHeadlineRecall(modifiedSurvey, "default");

    return modifiedSurvey;
  }, [localSurvey]);

  const blockLogic = useMemo(() => block.logic ?? [], [block.logic]);
  const blockLogicFallback = block.logicFallback;

  // Use the first element in the block as the reference element for default operators
  const firstElement = block.elements[0];

  const addLogic = () => {
    if (!firstElement) return;

    const operator = getDefaultOperatorForElement(firstElement, t);

    const initialCondition: TSurveyBlockLogic = {
      id: createId(),
      conditions: {
        id: createId(),
        connector: "and",
        conditions: [
          {
            id: createId(),
            leftOperand: {
              value: firstElement.id,
              type: "element",
            },
            operator,
          },
        ],
      },
      actions: [
        {
          id: createId(),
          objective: "jumpToBlock",
          target: "",
        },
      ],
    };

    updateBlockLogic(blockIdx, [...blockLogic, initialCondition]);
  };

  const handleRemoveLogic = (logicItemIdx: number) => {
    const logicCopy = structuredClone(blockLogic);
    const isLast = logicCopy.length === 1;
    logicCopy.splice(logicItemIdx, 1);

    updateBlockLogic(blockIdx, logicCopy);
    if (isLast) {
      updateBlockLogicFallback(blockIdx, undefined);
    }
  };

  const moveLogic = (from: number, to: number) => {
    const logicCopy = structuredClone(blockLogic);
    const [movedItem] = logicCopy.splice(from, 1);
    logicCopy.splice(to, 0, movedItem);

    updateBlockLogic(blockIdx, logicCopy);
  };

  const duplicateLogic = (logicItemIdx: number) => {
    const logicCopy = structuredClone(blockLogic);
    const logicItem = logicCopy[logicItemIdx];
    const newLogicItem = duplicateLogicItem(logicItem);
    logicCopy.splice(logicItemIdx + 1, 0, newLogicItem);

    updateBlockLogic(blockIdx, logicCopy);
  };

  const [parent] = useAutoAnimate();

  useEffect(() => {
    if (blockLogic.length === 0 && blockLogicFallback) {
      updateBlockLogicFallback(blockIdx, undefined);
    }
  }, [blockLogic, blockIdx, blockLogicFallback, updateBlockLogicFallback]);

  return (
    <div className="mt-4" ref={parent}>
      <Label className="flex gap-2">
        {t("environments.surveys.edit.conditional_logic")}
        <SplitIcon className="h-4 w-4 rotate-90" />
      </Label>

      {blockLogic.length > 0 && (
        <div className="mt-2 flex flex-col gap-4" ref={parent}>
          {blockLogic.map((logicItem, logicItemIdx) => (
            <div
              key={logicItem.id}
              className="relative flex w-full grow items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <LogicEditor
                localSurvey={transformedSurvey}
                logicItem={logicItem}
                updateBlockLogic={updateBlockLogic}
                updateBlockLogicFallback={updateBlockLogicFallback}
                block={block}
                blockIdx={blockIdx}
                logicIdx={logicItemIdx}
                isLast={logicItemIdx === blockLogic.length - 1}
              />

              {logicItem.conditions.conditions.length > 1 && (
                <DropdownMenu>
                  <DropdownMenuTrigger id={`logic-item-${logicItem.id}-dropdown`} asChild>
                    <Button
                      variant="secondary"
                      aria-label="More options"
                      className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-md">
                      <EllipsisVerticalIcon className="h-4 w-4 text-slate-700 hover:text-slate-950" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="mt-10">
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
                      disabled={logicItemIdx === blockLogic.length - 1}
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
              )}
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
