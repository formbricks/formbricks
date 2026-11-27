"use client";

import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";

/**
 * Shown next to a response's saved identifier when the workspace no longer reaches its contact (ADR 0061):
 * the contact sits in another contact directory, or the workspace has none. A button only so the tooltip
 * opens from the keyboard; it stops the click so a clickable row around it does not open.
 */
export const ContactNotAvailable = ({ className }: { readonly className?: string }) => {
  const { t } = useTranslation();

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              "shrink-0 cursor-default rounded text-xs text-slate-500 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-none",
              className
            )}
            onClick={(event) => event.stopPropagation()}>
            {t("workspace.surveys.responses.contact_not_available")}
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          {t("workspace.surveys.responses.contact_not_available_description")}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
