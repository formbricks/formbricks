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
import { PublishedLockNotice } from "@/modules/survey/editor/components/published-lock-notice";
import { NO_ELEMENT_LOCK, TElementLock } from "@/modules/survey/editor/lib/published-lock";
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
  isInvalid: boolean;
  locale: TUserLocale;
  isStorageConfigured: boolean;
  lock?: TElementLock;
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
  isInvalid,
  locale,
  isStorageConfigured,
  lock = NO_ELEMENT_LOCK,
}: MatrixSortableItemProps): JSX.Element => {
  const { t } = useTranslation();

  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: choice.id,
  });

  const listKey = type === "row" ? "rows" : "columns";
  const isTextLocked = lock.isOptionTextLocked(listKey, choice.id, "default");
  const isDeleteLocked = lock.isOptionLocked(listKey, choice.id);

  const style = {
    transition: transition ?? "transform 100ms ease",
    transform: CSS.Translate.toString(transform),
  };

  return (
    <div className="flex w-full items-center gap-2" ref={setNodeRef} style={style}>
      <div {...listeners} {...attributes}>
        <GripVerticalIcon className="size-4 cursor-move text-slate-400" />
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
          isInvalid={isInvalid}
          locale={locale}
          onKeyDown={onKeyDown}
          isStorageConfigured={isStorageConfigured}
          disabled={isTextLocked}
        />
        {isTextLocked && <PublishedLockNotice kind="optionText" className="ml-2" />}
        {canDelete && (
          <TooltipRenderer
            data-testid="tooltip-renderer"
            tooltipContent={
              isDeleteLocked ? t("workspace.surveys.edit.lock_explanation_option_delete") : t("common.delete")
            }
            className={isDeleteLocked ? "max-w-xs text-xs" : undefined}>
            <Button
              variant="ghost"
              size="icon"
              className="ml-2"
              disabled={isDeleteLocked}
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
