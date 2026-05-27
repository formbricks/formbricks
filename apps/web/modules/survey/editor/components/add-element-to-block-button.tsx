"use client";

import { createId } from "@paralleldrive/cuid2";
import { type Workspace } from "@prisma/client";
import { PlusIcon } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import { addMultiLanguageLabels, extractLanguageCodes } from "@/lib/i18n/utils";
import { addElementToBlock } from "@/modules/survey/editor/lib/blocks";
import { scrollElementCardIntoView } from "@/modules/survey/editor/lib/utils";
import {
  getCXElementNameMap,
  getElementDefaults,
  getElementIconMap,
  getElementNameMap,
  universalElementPresets,
} from "@/modules/survey/lib/elements";
import { Button } from "@/modules/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";

interface AddElementToBlockButtonProps {
  localSurvey: TSurvey;
  block: TSurveyBlock;
  setLocalSurvey: (survey: TSurvey) => void;
  setActiveElementId: (elementId: string) => void;
  workspace: Workspace;
  isCxMode: boolean;
}

export const AddElementToBlockButton = ({
  localSurvey,
  block,
  setLocalSurvey,
  setActiveElementId,
  workspace,
  isCxMode,
}: AddElementToBlockButtonProps) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const availableElementTypes = isCxMode ? getCXElementNameMap(t) : getElementNameMap(t);
  const ELEMENTS_ICON_MAP = getElementIconMap(t);

  const handleAddElement = (elementType: string) => {
    // Get language symbols and add multi-language support
    const languageSymbols = extractLanguageCodes(localSurvey.languages);

    const elementDefaults = getElementDefaults(elementType, workspace, t);
    const elementWithLabels = addMultiLanguageLabels(
      {
        ...universalElementPresets,
        ...elementDefaults,
        id: createId(),
        type: elementType,
      },
      languageSymbols
    );

    const result = addElementToBlock(localSurvey, block.id, elementWithLabels);

    if (!result.ok) {
      toast.error(result.error.message);
      setOpen(false);
      return;
    }

    setLocalSurvey(result.data);
    setOpen(false);
    setActiveElementId(elementWithLabels.id);
    scrollElementCardIntoView(elementWithLabels.id);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary">
          <PlusIcon className="size-4" />
          <div>
            <p className="text-sm font-medium text-slate-900">
              {t("workspace.surveys.edit.add_question_to_block")}
            </p>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {Object.entries(availableElementTypes).map(([type, name]) => (
          <DropdownMenuItem key={type} className="min-h-8" onClick={() => handleAddElement(type)}>
            {ELEMENTS_ICON_MAP[type as TSurveyElementTypeEnum]}
            <span className="ml-2">{name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
