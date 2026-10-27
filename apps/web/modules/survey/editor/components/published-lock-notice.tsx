"use client";

import { LockIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";

export type TPublishedLockKind = "code" | "type" | "optionText" | "optionDelete";

interface PublishedLockNoticeProps {
  kind: TPublishedLockKind;
  className?: string;
}

/**
 * The lock icon of a field that cannot change once the survey is published. Hovering or focusing it
 * explains why, including that a scheduled survey locks when it is scheduled (ADR 0015).
 */
export const PublishedLockNotice = ({ kind, className }: Readonly<PublishedLockNoticeProps>) => {
  const { t } = useTranslation();

  const explanation = {
    code: t("workspace.surveys.edit.lock_explanation_code"),
    type: t("workspace.surveys.edit.lock_explanation_type"),
    optionText: t("workspace.surveys.edit.lock_explanation_option_text"),
    optionDelete: t("workspace.surveys.edit.lock_explanation_option_delete"),
  }[kind];

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={t("workspace.surveys.edit.locked_after_publishing")}
            data-testid={`published-lock-${kind}`}
            className={cn(
              "inline-flex size-6 shrink-0 items-center justify-center rounded text-slate-500 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-none",
              className
            )}
            onClick={(event) => event.stopPropagation()}>
            <LockIcon className="size-3.5" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs leading-relaxed">
          <p className="mb-1 font-semibold">{t("workspace.surveys.edit.locked_after_publishing")}</p>
          <p>{explanation}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
