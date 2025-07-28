"use client";

import { cn } from "@/lib/cn";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";
import { useTranslate } from "@tolgee/react";
import { Check, Copy } from "lucide-react";
import React from "react";

interface BadgeContentProps {
  id: string | number;
  isCopyEnabled: boolean;
  className?: string;
  handleCopy: (e: React.MouseEvent) => void;
  isHovered: boolean;
  setIsHovered: (hovered: boolean) => void;
  shouldShowIcon: boolean;
  isCopied: boolean;
  label?: string;
}

export const BadgeContent: React.FC<BadgeContentProps> = ({
  id,
  isCopyEnabled,
  className,
  handleCopy,
  isHovered,
  setIsHovered,
  shouldShowIcon,
  isCopied,
  label,
}) => {
  const { t } = useTranslate();
  const getAriaLabel = () => {
    const prefix = "Copy";
    const labelPart = label ? ` ${label}` : "";
    return `${prefix}${labelPart} ${id}`;
  };

  const getButtonClasses = () => {
    const baseClasses =
      "inline-flex cursor-default items-center gap-2 rounded-md border border-slate-200 px-2 py-1 text-xs font-regular text-slate-500";
    const interactiveClasses = "cursor-pointer hover:border-transparent hover:text-slate-50";
    const hoverBg = isCopied ? "hover:bg-slate-900" : "hover:bg-slate-900/80";

    return cn(baseClasses, isCopyEnabled && interactiveClasses, isCopyEnabled && hoverBg, className);
  };

  const renderIcon = () => {
    if (!shouldShowIcon) return null;

    return (
      <div
        data-testid="copy-icon"
        className="flex h-4 w-4 items-center justify-center rounded transition-colors"
        title={t("common.copy")}>
        {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </div>
    );
  };

  const content = (
    <button
      type="button"
      role={isCopyEnabled ? "button" : undefined}
      className={getButtonClasses()}
      onClick={handleCopy}
      onMouseEnter={isCopyEnabled ? () => setIsHovered(true) : undefined}
      aria-label={getAriaLabel()}
      onMouseLeave={isCopyEnabled ? () => setIsHovered(false) : undefined}>
      <span>{id}</span>
      {renderIcon()}
    </button>
  );

  const getTooltipContent = () => {
    if (isCopied) {
      return t("common.copied");
    }
    return t("common.copy");
  };

  if (!isCopyEnabled) {
    return content;
  }

  return (
    <TooltipProvider>
      <Tooltip delayDuration={0} open={isHovered}>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent className="translate-y-[2px] border-none bg-slate-900 text-xs text-slate-50">
          <p>{getTooltipContent()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
