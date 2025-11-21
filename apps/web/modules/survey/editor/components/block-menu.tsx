"use client";

import { ArrowDownIcon, ArrowUpIcon, CopyIcon, TrashIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";

interface BlockMenuProps {
  isFirstBlock: boolean;
  isLastBlock: boolean;
  isOnlyBlock: boolean;
  onDuplicate: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export const BlockMenu = ({
  isFirstBlock,
  isLastBlock,
  isOnlyBlock,
  onDuplicate,
  onDelete,
  onMoveUp,
  onMoveDown,
}: BlockMenuProps) => {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-1">
      <TooltipRenderer tooltipContent={t("common.move_up")}>
        <Button
          variant="ghost"
          size="icon"
          disabled={isFirstBlock}
          onClick={(e) => {
            if (!isFirstBlock) {
              e.stopPropagation();
              onMoveUp();
            }
          }}
          className="h-8 w-8">
          <ArrowUpIcon className="h-4 w-4" />
        </Button>
      </TooltipRenderer>

      <TooltipRenderer tooltipContent={t("common.move_down")}>
        <Button
          variant="ghost"
          size="icon"
          disabled={isLastBlock}
          onClick={(e) => {
            if (!isLastBlock) {
              e.stopPropagation();
              onMoveDown();
            }
          }}
          className="h-8 w-8">
          <ArrowDownIcon className="h-4 w-4" />
        </Button>
      </TooltipRenderer>

      <TooltipRenderer tooltipContent={t("environments.surveys.edit.duplicate_block")}>
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate();
          }}
          className="h-8 w-8">
          <CopyIcon className="h-4 w-4" />
        </Button>
      </TooltipRenderer>

      <TooltipRenderer tooltipContent={t("environments.surveys.edit.delete_block")}>
        <Button
          variant="ghost"
          size="icon"
          disabled={isOnlyBlock}
          onClick={(e) => {
            if (!isOnlyBlock) {
              e.stopPropagation();
              onDelete();
            }
          }}
          className="h-8 w-8">
          <TrashIcon className="h-4 w-4" />
        </Button>
      </TooltipRenderer>
    </div>
  );
};
