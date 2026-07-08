"use client";

import { LanguagesIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getLanguageLabel } from "@formbricks/i18n-utils/src/utils";
import { cn } from "@/lib/cn";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";

interface TranslatedBadgeProps {
  /** BCP-47 target language the text was translated into (e.g. "en"). */
  langKey: string | null;
  /** The untranslated source text, shown in the tooltip. */
  original: string | null;
  locale: string;
  className?: string;
}

/**
 * Reusable "Translated to {language}" chip with the original text in a tooltip. Shared by the
 * feedback record list and the taxonomy record cards. Stops click/keydown propagation so it can
 * live inside clickable rows without triggering their handlers.
 */
export const TranslatedBadge = ({ langKey, original, locale, className }: Readonly<TranslatedBadgeProps>) => {
  const { t } = useTranslation();
  const langLabel = langKey ? (getLanguageLabel(langKey, locale) ?? langKey) : null;
  const label = langLabel
    ? t("workspace.unify.translated_to", { language: langLabel })
    : t("workspace.unify.translated");

  const stopPropagation = (event: { stopPropagation: () => void }) => event.stopPropagation();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex shrink-0 cursor-default items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600",
              className
            )}
            aria-label={label}
            onClick={stopPropagation}
            onKeyDown={stopPropagation}>
            <LanguagesIcon aria-hidden="true" className="size-3" />
            {label}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-sm whitespace-pre-wrap">
          <span className="font-medium">{t("workspace.unify.original_text")}: </span>
          {original ?? "—"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
