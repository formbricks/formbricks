"use client";

import { ArrowDownIcon, ArrowUpIcon, CopyIcon, TrashIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";

interface RuleRowActionsProps {
  readonly isFirst: boolean;
  readonly isLast: boolean;
  readonly onMoveUp: () => void;
  readonly onMoveDown: () => void;
  readonly onDuplicate: () => void;
  readonly onDelete: () => void;
}

/**
 * A rule row's controls in its header, in the question card header's order and look (move up, move
 * down, duplicate, delete), one size smaller so a rule's header stays smaller than a question's.
 */
export function RuleRowActions({
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
}: RuleRowActionsProps) {
  const { t } = useTranslation();

  const renderButton = (label: string, icon: ReactNode, onClick: () => void, disabled = false) => (
    <TooltipRenderer tooltipContent={label}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        aria-label={label}
        disabled={disabled}
        onClick={onClick}>
        {icon}
      </Button>
    </TooltipRenderer>
  );

  return (
    <>
      {renderButton(t("common.move_up"), <ArrowUpIcon />, onMoveUp, isFirst)}
      {renderButton(t("common.move_down"), <ArrowDownIcon />, onMoveDown, isLast)}
      {renderButton(t("common.duplicate"), <CopyIcon />, onDuplicate)}
      {renderButton(t("common.delete"), <TrashIcon />, onDelete)}
    </>
  );
}
