"use client";

import { FileDigitIcon, FileType2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { type TLinkedEmbeddedField } from "@formbricks/types/embedded-data-resolver";
import { TResponseVariables } from "@formbricks/types/responses";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";

interface ResponseVariablesProps {
  /** The survey's computed Embedded Data fields, resolved through `getSurveyEmbeddedFields`. */
  variables: TLinkedEmbeddedField[];
  variablesData: TResponseVariables;
}

export const ResponseVariables = ({ variables, variablesData }: Readonly<ResponseVariablesProps>) => {
  const { t } = useTranslation();
  return (
    <div className="mt-6 flex flex-col gap-6">
      {variables.map(({ field, link }) => {
        if (
          variablesData[link.storageKey] === undefined ||
          !["string", "number"].includes(typeof variablesData[link.storageKey])
        )
          return null;
        return (
          <div key={link.storageKey}>
            <div className="flex gap-x-2 text-sm text-slate-500">
              <p>{field.name}</p>
              <div className="flex items-center gap-x-2 rounded-full bg-slate-100 px-2">
                <TooltipProvider delayDuration={50}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      {field.dataType === "number" ? (
                        <FileDigitIcon className="size-4" />
                      ) : (
                        <FileType2Icon className="size-4" />
                      )}
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[300px]" side="top">
                      {t("common.variable")}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
            <p className="ph-no-capture mt-2 font-semibold text-slate-700">
              {variablesData[link.storageKey]}
            </p>
          </div>
        );
      })}
    </div>
  );
};
