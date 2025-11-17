"use client";

import { ArrowRightIcon } from "lucide-react";
import { ReactElement, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { TSurveyBlockLogic } from "@formbricks/types/surveys/blocks";
import { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import { TSurvey } from "@formbricks/types/surveys/types";
import { getTextContent } from "@formbricks/types/surveys/validation";
import { recallToHeadline } from "@/lib/utils/recall";
import { LogicEditorActions } from "@/modules/survey/editor/components/logic-editor-actions";
import { LogicEditorConditions } from "@/modules/survey/editor/components/logic-editor-conditions";
import { getQuestionIconMap } from "@/modules/survey/lib/questions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";

interface LogicEditorProps {
  localSurvey: TSurvey;
  logicItem: TSurveyBlockLogic;
  updateBlockLogic: (blockIdx: number, logic: TSurveyBlockLogic[]) => void;
  updateBlockLogicFallback: (blockIdx: number, logicFallback: string | undefined) => void;
  block: TSurveyBlock;
  blockIdx: number;
  logicIdx: number;
  isLast: boolean;
}

export function LogicEditor({
  localSurvey,
  logicItem,
  updateBlockLogic,
  updateBlockLogicFallback,
  block,
  blockIdx,
  logicIdx,
  isLast,
}: LogicEditorProps) {
  const { t } = useTranslation();
  const QUESTIONS_ICON_MAP = getQuestionIconMap(t);

  const blockLogicFallback = block.logicFallback;

  const fallbackOptions = useMemo(() => {
    let options: {
      icon?: ReactElement;
      label: string;
      value: string;
    }[] = [];

    const blocks = localSurvey.blocks;

    // Track which blocks we've already added to avoid duplicates when a block has multiple elements
    const addedBlockIds = new Set<string>();

    // Iterate over the elements AFTER the current block
    for (let i = blockIdx + 1; i < blocks.length; i++) {
      const currentBlock = blocks[i];

      if (addedBlockIds.has(currentBlock.id)) continue;

      addedBlockIds.add(currentBlock.id);

      // Use the first element's headline as the block label
      const firstElement = currentBlock.elements[0];
      if (!firstElement) continue;

      options.push({
        icon: QUESTIONS_ICON_MAP[firstElement.type],
        label: getTextContent(
          recallToHeadline(firstElement.headline, localSurvey, false, "default").default ?? ""
        ),
        value: currentBlock.id,
      });
    }

    localSurvey.endings.forEach((ending) => {
      options.push({
        label:
          ending.type === "endScreen"
            ? getTextContent(
                recallToHeadline(ending.headline ?? { default: "" }, localSurvey, false, "default").default ??
                  ""
              ) || t("environments.surveys.edit.end_screen_card")
            : ending.label || t("environments.surveys.edit.redirect_thank_you_card"),
        value: ending.id,
      });
    });

    return options;
  }, [localSurvey, blockIdx, QUESTIONS_ICON_MAP, t]);

  return (
    <div className="flex w-full min-w-full grow flex-col gap-4 overflow-x-auto pb-2 text-sm">
      <LogicEditorConditions
        conditions={logicItem.conditions}
        updateBlockLogic={updateBlockLogic}
        block={block}
        blockIdx={blockIdx}
        localSurvey={localSurvey}
        logicIdx={logicIdx}
      />
      <LogicEditorActions
        logicItem={logicItem}
        logicIdx={logicIdx}
        block={block}
        updateBlockLogic={updateBlockLogic}
        localSurvey={localSurvey}
        blockIdx={blockIdx}
      />

      {isLast ? (
        <div className="flex items-center gap-x-2">
          <div className="flex w-10 shrink-0 items-center justify-end">
            <ArrowRightIcon className="h-4 w-4 text-slate-500" />
          </div>
          <p className="text-nowrap font-medium text-slate-900">
            {t("environments.surveys.edit.all_other_answers_will_continue_to")}
          </p>
          <Select
            autoComplete="true"
            defaultValue={blockLogicFallback || "defaultSelection"}
            onValueChange={(val) => {
              updateBlockLogicFallback(blockIdx, val === "defaultSelection" ? undefined : val);
            }}>
            <SelectTrigger className="w-auto bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem key="fallback_default_selection" value={"defaultSelection"}>
                {t("environments.surveys.edit.next_question")}
              </SelectItem>

              {fallbackOptions.map((option) => (
                <SelectItem key={`fallback_${option.value}`} value={option.value}>
                  <div className="flex items-center gap-2">
                    {option.icon}
                    {option.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
    </div>
  );
}
