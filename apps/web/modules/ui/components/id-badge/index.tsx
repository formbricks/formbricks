"use client";

import { cn } from "@/lib/cn";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";
import { useTranslate } from "@tolgee/react";
import { Check, Copy } from "lucide-react";
import React, { useState } from "react";
import toast from "react-hot-toast";

interface IdBadgeProps {
  id: string | number;
  showCopyIcon?: boolean;
  showCopyIconOnHover?: boolean;
  className?: string;
  prefix?: string;
}

export const IdBadge: React.FC<IdBadgeProps> = ({
  id,
  showCopyIcon = true,
  showCopyIconOnHover = false,
  className,
  prefix,
}) => {
  const { t } = useTranslate();
  const [isHovered, setIsHovered] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      navigator.clipboard.writeText(String(id));
      toast.success(t("common.copied_to_clipboard"));
      setIsCopied(true);
      setTimeout(() => {
        setIsCopied(false);
      }, 2000);
    } catch (error) {
      toast.error("Failed to copy ID");
    }
  };

  const shouldShowIcon = showCopyIcon && (!showCopyIconOnHover || isHovered);

  return (
    <TooltipProvider>
      <Tooltip delayDuration={0} open={isHovered}>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-500 hover:border-transparent hover:bg-slate-900 hover:text-slate-50",
              className
            )}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}>
            <span>
              {prefix ? `${prefix} ` : ""}
              {id}
            </span>

            {shouldShowIcon && (
              <button
                onClick={handleCopy}
                className="flex h-4 w-4 items-center justify-center rounded transition-colors"
                title={t("common.copy")}
                aria-label={`Copy ${prefix ? `${prefix} ` : ""}${id}`}>
                {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent className="bg-slate-900 text-slate-50">
          <p>{isCopied ? t("common.copied") : t("common.copy")}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
