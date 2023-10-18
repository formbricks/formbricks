"use client";

import { cn } from "@formbricks/lib/cn";
import { TSurvey, TSurveyHiddenFields, TSurveyQuestions } from "@formbricks/types/v1/surveys";
import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";
import { Switch } from "@formbricks/ui/Switch";
import { Tag } from "@formbricks/ui/Tag";
import * as Collapsible from "@radix-ui/react-collapsible";
import { FC, useState } from "react";
import toast from "react-hot-toast";

interface HiddenFieldsCardProps {
  localSurvey: TSurvey;
  setLocalSurvey: (survey: TSurvey) => void;
  activeQuestionId: string | null;
  setActiveQuestionId: (questionId: string | null) => void;
}

const HiddenFieldsCard: FC<HiddenFieldsCardProps> = ({
  activeQuestionId,
  localSurvey,
  setActiveQuestionId,
  setLocalSurvey,
}) => {
  const open = activeQuestionId == "hidden";
  const [hiddenField, setHiddenField] = useState<string>("");

  const setOpen = (open: boolean) => {
    if (open) {
      setActiveQuestionId("hidden");
    } else {
      setActiveQuestionId(null);
    }
  };

  const updateSurvey = (data: TSurveyHiddenFields) => {
    setLocalSurvey({
      ...localSurvey,
      hiddenFields: {
        ...localSurvey.hiddenFields,
        ...data,
      },
    });
  };

  return (
    <div
      className={cn(
        open ? "scale-100 shadow-lg " : "scale-97 shadow-md",
        "flex flex-row rounded-lg bg-white transition-transform duration-300 ease-in-out"
      )}>
      <div
        className={cn(
          open ? "bg-slate-700" : "bg-slate-400",
          "flex w-10 items-center justify-center rounded-l-lg hover:bg-slate-600 group-aria-expanded:rounded-bl-none"
        )}>
        <p>👁️</p>
      </div>
      <Collapsible.Root
        open={open}
        onOpenChange={setOpen}
        className="flex-1 rounded-r-lg border border-slate-200 transition-all duration-300 ease-in-out">
        <Collapsible.CollapsibleTrigger
          asChild
          className="flex cursor-pointer justify-between p-4 hover:bg-slate-50">
          <div>
            <div className="inline-flex">
              <div>
                <p className="text-sm font-semibold">Hidden Fields</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Label htmlFor="hidden-fields-toggle">Enabled</Label>

              <Switch
                id="hidden-fields-toggle"
                checked={localSurvey?.hiddenFields?.enabled}
                onClick={(e) => {
                  e.stopPropagation();
                  updateSurvey({ enabled: !localSurvey.hiddenFields?.enabled });
                }}
              />
            </div>
          </div>
        </Collapsible.CollapsibleTrigger>
        <Collapsible.CollapsibleContent className="px-4 pb-6">
          <div className="flex gap-2">
            {localSurvey.hiddenFields?.fieldIds && localSurvey.hiddenFields?.fieldIds?.length > 0 ? (
              localSurvey.hiddenFields?.fieldIds?.map((question) => {
                return (
                  <Tag
                    key={question}
                    onDelete={() => {
                      updateSurvey({
                        enabled: true,
                        fieldIds: localSurvey.hiddenFields?.fieldIds?.filter((q) => q !== question),
                      });
                    }}
                    tagId={question}
                    tagName={question}
                  />
                );
              })
            ) : (
              <p className="text-sm italic text-gray-500">No hidden fields yet. Add the first one below.</p>
            )}
          </div>
          <form
            className="mt-5"
            onSubmit={(e) => {
              e.preventDefault();

              const errorMessage = validateHiddenField(
                // current field
                hiddenField,
                // existing fields
                localSurvey.hiddenFields?.fieldIds || [],
                // existing questions
                localSurvey.questions
              );

              if (errorMessage !== "") return toast.error(errorMessage);

              updateSurvey({
                fieldIds: [...(localSurvey.hiddenFields?.fieldIds || []), hiddenField],
                enabled: true,
              });
              setHiddenField("");
            }}>
            <Label htmlFor="headline">Hidden Field</Label>
            <div className="mt-2">
              <Input
                autoFocus
                id="headline"
                name="headline"
                value={hiddenField}
                onChange={(e) => setHiddenField(e.target.value.trim())}
                placeholder="Type field id..."
              />
            </div>
          </form>
        </Collapsible.CollapsibleContent>
      </Collapsible.Root>
    </div>
  );
};

export default HiddenFieldsCard;

const validateHiddenField = (
  field: string,
  existingFields: string[],
  existingQuestions: TSurveyQuestions
): string => {
  if (field.trim() === "") {
    return "Please enter a question";
  }
  // no duplicate questions
  if (existingFields.findIndex((q) => q.toLowerCase() === field.toLowerCase()) !== -1) {
    return "Question already exists";
  }
  // no key words -- userId & suid & existing question ids
  if (["userId", "suid"].includes(field) || existingQuestions.findIndex((q) => q.id === field) !== -1) {
    return "Question not allowed";
  }
  // no spaced words --> should be valid query param on url
  if (field.includes(" ")) {
    return "Question not allowed, avoid using spaces";
  }
  // Check if the parameter contains only alphanumeric characters
  if (!/^[a-zA-Z0-9]+$/.test(field)) {
    return "Question not allowed, avoid using special characters";
  }

  return "";
};
