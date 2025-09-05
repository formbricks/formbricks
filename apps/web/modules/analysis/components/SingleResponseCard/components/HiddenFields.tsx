"use client";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";
import { useTranslate } from "@tolgee/react";
import { EyeOffIcon } from "lucide-react";
import { TResponseData } from "@formbricks/types/responses";
import { TSurveyHiddenFields } from "@formbricks/types/surveys/types";

interface HiddenFieldsProps {
  hiddenFields: TSurveyHiddenFields;
  responseData: TResponseData;
}

export const HiddenFields = ({ hiddenFields, responseData }: HiddenFieldsProps) => {
  const { t } = useTranslate();
  const fieldIds = hiddenFields.fieldIds ?? [];

  let hiddenFieldsData: { field: string; value: string }[] = [];

  fieldIds.forEach((field) => {
    if (responseData[field]) {
      hiddenFieldsData.push({
        field,
        value: typeof responseData[field] === "string" ? responseData[field] : "",
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
          <div key={fieldData.field}>
            <div className="flex space-x-2 text-sm text-slate-500">
              <p>{fieldData.field}</p>
              <div className="flex items-center space-x-2 rounded-full bg-slate-100 px-2">
                <TooltipProvider delayDuration={50}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <EyeOffIcon className="h-4 w-4" />
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
