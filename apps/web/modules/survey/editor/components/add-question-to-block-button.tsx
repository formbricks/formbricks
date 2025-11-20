"use client";

import { createId } from "@paralleldrive/cuid2";
import { type Project } from "@prisma/client";
import { PlusIcon } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import { TSurvey } from "@formbricks/types/surveys/types";
import { addMultiLanguageLabels, extractLanguageCodes } from "@/lib/i18n/utils";
import { addElementToBlock } from "@/modules/survey/editor/lib/blocks";
import {
  getCXQuestionNameMap,
  getQuestionDefaults,
  getQuestionIconMap,
  getQuestionNameMap,
  universalQuestionPresets,
} from "@/modules/survey/lib/questions";
import { Button } from "@/modules/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";

interface AddQuestionToBlockButtonProps {
  localSurvey: TSurvey;
  block: TSurveyBlock;
  setLocalSurvey: (survey: TSurvey) => void;
  setActiveQuestionId: (questionId: string) => void;
  project: Project;
  isCxMode: boolean;
}

export const AddQuestionToBlockButton = ({
  localSurvey,
  block,
  setLocalSurvey,
  setActiveQuestionId,
  project,
  isCxMode,
}: AddQuestionToBlockButtonProps) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const availableQuestionTypes = isCxMode ? getCXQuestionNameMap(t) : getQuestionNameMap(t);
  const QUESTIONS_ICON_MAP = getQuestionIconMap(t);

  const handleAddQuestion = (questionType: string) => {
    // Get language symbols and add multi-language support
    const languageSymbols = extractLanguageCodes(localSurvey.languages);

    const questionDefaults = getQuestionDefaults(questionType, project, t);
    const questionWithLabels = addMultiLanguageLabels(
      {
        ...universalQuestionPresets,
        ...questionDefaults,
        id: createId(),
        type: questionType,
      },
      languageSymbols
    );

    const result = addElementToBlock(localSurvey, block.id, questionWithLabels);

    if (!result.ok) {
      toast.error(result.error.message);
      setOpen(false);
      return;
    }

    setLocalSurvey(result.data);
    setOpen(false);
    setActiveQuestionId(questionWithLabels.id);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary">
          <PlusIcon className="h-4 w-4" />
          <div>
            <p className="text-sm font-medium text-slate-900">
              {t("environments.surveys.edit.add_question_to_block")}
            </p>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {Object.entries(availableQuestionTypes).map(([type, name]) => (
          <DropdownMenuItem key={type} className="min-h-8" onClick={() => handleAddQuestion(type)}>
            {QUESTIONS_ICON_MAP[type]}
            <span className="ml-2">{name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
