import { EyeOffIcon } from "lucide-react";

import { TResponseData } from "@formbricks/types/responses";
import { TSurveyHiddenFields } from "@formbricks/types/surveys";

interface HiddenFieldsProps {
  hiddenFields: TSurveyHiddenFields;
  responseData: TResponseData;
}

export const HiddenFields = ({ hiddenFields, responseData }: HiddenFieldsProps) => {
  const fieldIds = hiddenFields.fieldIds ?? [];
  return (
    <div className="mt-6 flex flex-col gap-6">
      {fieldIds.map((field) => {
        if (!responseData[field]) return;
        return (
          <div key={field}>
            <div className="flex space-x-2 text-sm text-slate-500">
              <div className="flex items-center space-x-2 rounded-md bg-slate-100 px-2">
                <EyeOffIcon className="h-4 w-4" />
                <p>Hidden Field</p>
              </div>
              <p>{field}</p>
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
