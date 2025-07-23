"use client";

import { cn } from "@/lib/cn";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";
import { useTranslate } from "@tolgee/react";
import { Check, Copy } from "lucide-react";
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { logger } from "@formbricks/logger";

interface IdBadgeProps {
  id: string | number;
  copyDisabled?: boolean;
  showCopyIconOnHover?: boolean;
  className?: string;
  label?: string;
  variant?: "row" | "column";
}

export const IdBadge: React.FC<IdBadgeProps> = ({
  id,
  copyDisabled = false,
  showCopyIconOnHover = false,
  className,
  label,
  variant = "row",
}) => {
  const { t } = useTranslate();
  const [isHovered, setIsHovered] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(String(id));
      } else {
        logger.error("Clipboard API not supported");
        throw new Error("Clipboard API not supported");
      }
      toast.success(t("common.copied_to_clipboard"));
      setIsCopied(true);
    } catch (error) {
      logger.error(error);
      toast.error(t("common.something_went_wrong_please_try_again"));
    }
  };

  // Add cooldown for copied state (10 seconds)
  useEffect(() => {
    if (isCopied) {
      const timer = setTimeout(() => {
        setIsCopied(false);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [isCopied]);

  const shouldShowIcon = showCopyIconOnHover ? isHovered : !copyDisabled;
  const isCopyEnabled = showCopyIconOnHover || !copyDisabled;

  const BadgeContent = () => {
    const content = (
      <button
        role={isCopyEnabled ? "button" : undefined}
        className={cn(
          "inline-flex cursor-default items-center gap-2 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-500",
          isCopyEnabled && "cursor-pointer hover:border-transparent hover:text-slate-50",
          isCopyEnabled && (isCopied ? "hover:bg-slate-900" : "hover:bg-slate-900/80"),
          className
        )}
        onClick={handleCopy}
        onMouseEnter={isCopyEnabled ? () => setIsHovered(true) : undefined}
        aria-label={`Copy ${label ? `${label} ` : ""}${id}`}
        onMouseLeave={isCopyEnabled ? () => setIsHovered(false) : undefined}>
        <span>{id}</span>

        {shouldShowIcon && (
          <div
            data-testid="copy-icon"
            className="flex h-4 w-4 items-center justify-center rounded transition-colors"
            title={t("common.copy")}>
            {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </div>
        )}
      </button>
    );

    if (!isCopyEnabled) {
      return content;
    }

    return (
      <TooltipProvider>
        <Tooltip delayDuration={0} open={isHovered}>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent className="bg-slate-900 text-xs text-slate-50">
            <p>{isCopied ? t("common.copied") : t("common.copy")}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  if (!label) {
    return <BadgeContent />;
  }

  if (variant === "column") {
    return (
      <div className="flex flex-col items-start gap-1">
        <span className="text-xs font-medium text-slate-700">{label}</span>
        <BadgeContent />
      </div>
    );
  }

  // Row variant (default)
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-slate-700">{label}</span>
      <BadgeContent />
    </div>
  );
};
