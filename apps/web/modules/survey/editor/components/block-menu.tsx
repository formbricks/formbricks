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
          className="size-8">
          <ArrowUpIcon className="size-4" />
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
          className="size-8">
          <ArrowDownIcon className="size-4" />
        </Button>
      </TooltipRenderer>

      <TooltipRenderer tooltipContent={t("workspace.surveys.edit.duplicate_block")}>
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate();
          }}
          className="size-8">
          <CopyIcon className="size-4" />
        </Button>
      </TooltipRenderer>

      <TooltipRenderer tooltipContent={t("workspace.surveys.edit.delete_block")}>
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
          className="size-8">
          <TrashIcon className="size-4" />
        </Button>
      </TooltipRenderer>
    </div>
  );
};
