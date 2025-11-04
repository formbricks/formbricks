"use client";

import { ArrowRightIcon } from "lucide-react";
import { ReactElement, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { TSurveyBlockLogic } from "@formbricks/types/surveys/blocks";
import { TSurveyElement } from "@formbricks/types/surveys/elements";
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
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  updateBlockLogic: (questionIdx: number, logic: TSurveyBlockLogic[]) => void;
  updateBlockLogicFallback: (questionIdx: number, logicFallback: string | undefined) => void;
  question: TSurveyElement;
  questionIdx: number;
  logicIdx: number;
  isLast: boolean;
}

export function LogicEditor({
  localSurvey,
  logicItem,
  updateQuestion,
  updateBlockLogic,
  updateBlockLogicFallback,
  question,
  questionIdx,
  logicIdx,
  isLast,
}: LogicEditorProps) {
  const { t } = useTranslation();
  const QUESTIONS_ICON_MAP = getQuestionIconMap(t);

  // Find the parent block for this question/element to get its logicFallback
  const parentBlock = localSurvey.blocks?.find((block) =>
    block.elements.some((element) => element.id === question.id)
  );
  const blockLogicFallback = parentBlock?.logicFallback;

  const fallbackOptions = useMemo(() => {
    let options: {
      icon?: ReactElement;
      label: string;
      value: string;
    }[] = [];

    // Derive questions from blocks
    const allQuestions = localSurvey.blocks.flatMap((b) => b.elements);
    const blocks = localSurvey.blocks;

    for (let i = questionIdx + 1; i < allQuestions.length; i++) {
      const ques = allQuestions[i];
      // Find block ID for this question
      const block = blocks.find((b) => b.elements.some((e) => e.id === ques.id));

      options.push({
        icon: QUESTIONS_ICON_MAP[ques.type],
        label: getTextContent(recallToHeadline(ques.headline, localSurvey, false, "default").default ?? ""),
        value: block?.id ?? ques.id, // Block ID if blocks exist, otherwise question ID
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
  }, [localSurvey, questionIdx, QUESTIONS_ICON_MAP, t]);

  return (
    <div className="flex w-full min-w-full grow flex-col gap-4 overflow-x-auto pb-2 text-sm">
      <LogicEditorConditions
        conditions={logicItem.conditions}
        updateQuestion={updateQuestion}
        updateBlockLogic={updateBlockLogic}
        question={question}
        questionIdx={questionIdx}
        localSurvey={localSurvey}
        logicIdx={logicIdx}
      />
      <LogicEditorActions
        logicItem={logicItem}
        logicIdx={logicIdx}
        question={question}
        updateQuestion={updateQuestion}
        updateBlockLogic={updateBlockLogic}
        localSurvey={localSurvey}
        questionIdx={questionIdx}
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
              updateBlockLogicFallback(questionIdx, val === "defaultSelection" ? undefined : val);
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
