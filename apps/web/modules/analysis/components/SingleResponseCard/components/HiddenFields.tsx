"use client";

import { EyeOffIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { labelEmbeddedFields } from "@formbricks/types/embedded-data-label";
import { type TLinkedEmbeddedField } from "@formbricks/types/embedded-data-resolver";
import { TResponseData } from "@formbricks/types/responses";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";

interface HiddenFieldsProps {
  /** The survey's ingested Embedded Data fields, resolved through `getSurveyEmbeddedFields`. */
  hiddenFields: TLinkedEmbeddedField[];
  responseData: TResponseData;
}

export const HiddenFields = ({ hiddenFields, responseData }: Readonly<HiddenFieldsProps>) => {
  const { t } = useTranslation();

  // ENG-3233: labelled over the survey's whole field list, *before* the empty-value filter below.
  // Allocating over the filtered list instead would make a label depend on which fields this one
  // response happened to capture, so the card would name a field differently from the table header
  // above it. `storageKey` stays the React key: it is unique per survey by `@@unique([surveyId,
  // storageKey])`, whereas a display name carries no uniqueness constraint.
  const hiddenFieldsData: { storageKey: string; label: string; value: string }[] = [];

  labelEmbeddedFields(hiddenFields).forEach(({ link, label }) => {
    const value = responseData[link.storageKey];
    if (value) {
      hiddenFieldsData.push({
        storageKey: link.storageKey,
        label,
        value: typeof value === "string" ? value : "",
      });
    }
  });

  if (hiddenFieldsData.length === 0) {
    return null;
  }

  return (
    <div data-testid="main-hidden-fields-div" className="mt-6 flex flex-col gap-6">
      {hiddenFieldsData.map((fieldData) => {
        return (
          <div key={fieldData.storageKey}>
            <div className="flex gap-x-2 text-sm text-slate-500">
              <p>{fieldData.label}</p>
              <div className="flex items-center gap-x-2 rounded-full bg-slate-100 px-2">
                <TooltipProvider delayDuration={50}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <EyeOffIcon className="size-4" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[300px]" side="top">
                      {t("common.hidden_field")}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
            <p className="ph-no-capture mt-2 font-semibold text-slate-700">{fieldData.value}</p>
          </div>
        );
      })}
    </div>
  );
};
