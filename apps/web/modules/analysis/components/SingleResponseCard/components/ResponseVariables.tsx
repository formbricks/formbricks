"use client";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";
import { useTranslate } from "@tolgee/react";
import { FileDigitIcon, FileType2Icon } from "lucide-react";
import { TResponseVariables } from "@formbricks/types/responses";
import { TSurveyVariables } from "@formbricks/types/surveys/types";

interface HiddenFieldsProps {
  variables: TSurveyVariables;
  variablesData: TResponseVariables;
}

export const ResponseVariables = ({ variables, variablesData }: HiddenFieldsProps) => {
  const { t } = useTranslate();
  return (
    <div className="mt-6 flex flex-col gap-6">
      {variables.map((variable) => {
        if (
          variablesData[variable.id] === undefined ||
          !["string", "number"].includes(typeof variablesData[variable.id])
        )
          return null;
        return (
          <div key={variable.id}>
            <div className="flex space-x-2 text-sm text-slate-500">
              <p>{variable.name}</p>
              <div className="flex items-center space-x-2 rounded-full bg-slate-100 px-2">
                <TooltipProvider delayDuration={50}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      {variable.type === "number" ? (
                        <FileDigitIcon className="h-4 w-4" />
                      ) : (
                        <FileType2Icon className="h-4 w-4" />
                      )}
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[300px]" side="top">
                      {t("common.variable")}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
            <p className="ph-no-capture mt-2 font-semibold text-slate-700">{variablesData[variable.id]}</p>
          </div>
        );
      })}
    </div>
  );
};
