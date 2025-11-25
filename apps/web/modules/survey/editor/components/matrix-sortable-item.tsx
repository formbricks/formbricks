"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon, TrashIcon } from "lucide-react";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { type TI18nString } from "@formbricks/types/i18n";
import { TSurveyMatrixElement, TSurveyMatrixElementChoice } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { ElementFormInput } from "@/modules/survey/components/element-form-input";
import { Button } from "@/modules/ui/components/button";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";

interface MatrixSortableItemProps {
  choice: TSurveyMatrixElementChoice;
  type: "row" | "column";
  index: number;
  localSurvey: TSurvey;
  element: TSurveyMatrixElement;
  elementIdx: number;
  updateMatrixLabel: (index: number, type: "row" | "column", matrixLabel: TI18nString) => void;
  onDelete: (index: number) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  canDelete: boolean;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (language: string) => void;
  isInvalid: boolean;
  locale: TUserLocale;
  isStorageConfigured: boolean;
}

export const MatrixSortableItem = ({
  choice,
  type,
  index,
  localSurvey,
  elementIdx,
  updateMatrixLabel,
  onDelete,
  onKeyDown,
  canDelete,
  selectedLanguageCode,
  setSelectedLanguageCode,
  isInvalid,
  locale,
  isStorageConfigured,
}: MatrixSortableItemProps): JSX.Element => {
  const { t } = useTranslation();

  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: choice.id,
  });

  const style = {
    transition: transition ?? "transform 100ms ease",
    transform: CSS.Translate.toString(transform),
  };

  return (
    <div className="flex w-full items-center gap-2" ref={setNodeRef} style={style}>
      <div {...listeners} {...attributes}>
        <GripVerticalIcon className="h-4 w-4 cursor-move text-slate-400" />
      </div>

      <div className="flex w-full items-center">
        <ElementFormInput
          key={choice.id}
          id={`${type}-${index}`}
          label=""
          localSurvey={localSurvey}
          elementIdx={elementIdx}
          value={choice.label}
          updateMatrixLabel={updateMatrixLabel}
          selectedLanguageCode={selectedLanguageCode}
          setSelectedLanguageCode={setSelectedLanguageCode}
          isInvalid={isInvalid}
          locale={locale}
          onKeyDown={onKeyDown}
          isStorageConfigured={isStorageConfigured}
        />
        {canDelete && (
          <TooltipRenderer data-testid="tooltip-renderer" tooltipContent={t("common.delete")}>
            <Button
              variant="ghost"
              size="icon"
              className="ml-2"
              onClick={(e) => {
                e.preventDefault();
                onDelete(index);
              }}>
              <TrashIcon />
            </Button>
          </TooltipRenderer>
        )}
      </div>
    </div>
  );
};
