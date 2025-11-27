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
  project: Project;
  isCxMode: boolean;
}

export const AddElementToBlockButton = ({
  localSurvey,
  block,
  setLocalSurvey,
  setActiveElementId,
  project,
  isCxMode,
}: AddElementToBlockButtonProps) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const availableElementTypes = isCxMode ? getCXElementNameMap(t) : getElementNameMap(t);
  const ELEMENTS_ICON_MAP = getElementIconMap(t);

  const handleAddElement = (elementType: string) => {
    // Get language symbols and add multi-language support
    const languageSymbols = extractLanguageCodes(localSurvey.languages);

    const elementDefaults = getElementDefaults(elementType, project, t);
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
        {Object.entries(availableElementTypes).map(([type, name]) => (
          <DropdownMenuItem key={type} className="min-h-8" onClick={() => handleAddElement(type)}>
            {ELEMENTS_ICON_MAP[type]}
            <span className="ml-2">{name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
