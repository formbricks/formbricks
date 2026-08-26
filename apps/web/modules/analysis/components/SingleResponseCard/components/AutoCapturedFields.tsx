"use client";

import * as Collapsible from "@radix-ui/react-collapsible";
import { ChevronRightIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  RESERVED_FIELD_CATALOG,
  listDisplayableReservedFields,
} from "@formbricks/types/embedded-data-resolver";
import { TResponse } from "@formbricks/types/responses";
import { RESERVED_FIELD_ICONS, getReservedFieldLabel } from "@/modules/analysis/lib/reserved-field-display";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";

interface AutoCapturedFieldsProps {
  response: TResponse;
}

/**
 * The auto-captured context a response carries beyond the seven fields the card has always shown
 * (ENG-2540): page, referrer, the five UTM params, screen and viewport, timezone, IP.
 *
 * **Why a fold in the card body rather than a fourth tooltip in the footer.** ENG-1841 captures twelve
 * fields on every response and the complaint the ticket opens with is that they are invisible — an
 * author could only reach them by exporting. A hover tooltip is a weak answer to that, and it is worse
 * on touch. The body already has the right idiom: `HiddenFields` and `ResponseVariables` render
 * label-over-value rows right here, and this reuses their markup so the three read as one family.
 *
 * Collapsed by default, because thirteen extra rows on every card is the other failure mode the
 * ticket names. Rendered only when the response actually carries something, so a response collected
 * before ENG-1841 — or one whose fields the Anonymize toggle dropped at ingest — shows no fold at
 * all rather than an empty one.
 *
 * Nothing here is a list of field names: {@link listDisplayableReservedFields} filters the catalog by
 * `display`, so an entry added by ENG-1858 appears with no change to this file.
 */
export const AutoCapturedFields = ({ response }: Readonly<AutoCapturedFieldsProps>) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const fields = listDisplayableReservedFields(RESERVED_FIELD_CATALOG, response, "secondary");

  if (fields.length === 0) {
    return null;
  }

  return (
    <Collapsible.Root
      open={isOpen}
      onOpenChange={setIsOpen}
      className="mt-6"
      data-testid="auto-captured-fields">
      <Collapsible.Trigger className="flex items-center gap-x-2 text-sm text-slate-500 hover:text-slate-700">
        <ChevronRightIcon className={`size-4 transition-transform ${isOpen ? "rotate-90" : ""}`} />
        <span>
          {t("workspace.surveys.responses.more_context")} ({fields.length})
        </span>
      </Collapsible.Trigger>
      <Collapsible.Content className="flex flex-col overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
        <div className="mt-4 flex flex-col gap-6">
          {fields.map(({ entry, value }) => {
            const label = getReservedFieldLabel(entry.name, t);
            const Icon = RESERVED_FIELD_ICONS[entry.name];

            return (
              <div key={entry.name}>
                <div className="flex gap-x-2 text-sm text-slate-500">
                  <p>{label}</p>
                  {Icon && (
                    <div className="flex items-center gap-x-2 rounded-full bg-slate-100 px-2">
                      <TooltipProvider delayDuration={50}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Icon className="size-4" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[300px]" side="top">
                            {t("workspace.surveys.responses.auto_captured_field")}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  )}
                </div>
                <p className="ph-no-capture mt-2 font-semibold text-slate-700">{value}</p>
              </div>
            );
          })}
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  );
};
