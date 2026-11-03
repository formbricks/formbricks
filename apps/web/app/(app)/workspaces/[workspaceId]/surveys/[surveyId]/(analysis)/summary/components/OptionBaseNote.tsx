"use client";

import { EyeOffIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";

interface OptionBaseNoteProps {
  /** Respondents shown the option, set only when fewer than everyone who answered (ENG-6937). */
  readonly shownCount?: number;
  /** The option is Hidden: retired on a live survey, kept in results (P1). */
  readonly hidden?: boolean;
}

/**
 * An option's base in the summary (ENG-6937): "Hidden" for a retired option, and "Shown to N" when
 * its percentage is over fewer respondents than answered the question. Renders nothing otherwise.
 */
export function OptionBaseNote({ shownCount, hidden }: OptionBaseNoteProps) {
  const { t } = useTranslation();
  if (shownCount === undefined && !hidden) return null;

  return (
    <span className="flex shrink-0 items-center gap-x-2 text-xs font-normal">
      {hidden && (
        <TooltipRenderer tooltipContent={t("workspace.surveys.summary.hidden_option_tooltip")}>
          <span className="flex items-center gap-x-1 rounded-md bg-slate-200 px-1.5 py-0.5 text-slate-700">
            <EyeOffIcon className="size-3" aria-hidden />
            {t("workspace.surveys.summary.hidden_option")}
          </span>
        </TooltipRenderer>
      )}
      {shownCount !== undefined && (
        <TooltipRenderer tooltipContent={t("workspace.surveys.summary.shown_to_count_tooltip")}>
          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-slate-600">
            {t("workspace.surveys.summary.shown_to_count", { count: shownCount })}
          </span>
        </TooltipRenderer>
      )}
    </span>
  );
}
