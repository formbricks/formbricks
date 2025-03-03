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
  return (
    <div className="mt-6 flex flex-col gap-6">
      {fieldIds.map((field) => {
        if (!responseData[field]) return;
        return (
          <div key={field}>
            <div className="flex space-x-2 text-sm text-slate-500">
              <p>{field}</p>
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
            <p className="ph-no-capture mt-2 font-semibold text-slate-700">
              {typeof responseData[field] === "string" ? (responseData[field] as string) : ""}
            </p>
          </div>
        );
      })}
    </div>
  );
};
