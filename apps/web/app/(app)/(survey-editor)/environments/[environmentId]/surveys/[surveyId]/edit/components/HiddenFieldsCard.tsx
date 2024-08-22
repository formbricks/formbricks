"use client";

import * as Collapsible from "@radix-ui/react-collapsible";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { cn } from "@formbricks/lib/cn";
import { extractRecallInfo } from "@formbricks/lib/utils/recall";
import { TSurvey, TSurveyHiddenFields } from "@formbricks/types/surveys/types";
import { validateId } from "@formbricks/types/surveys/validation";
import { Button } from "@formbricks/ui/Button";
import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";
import { Switch } from "@formbricks/ui/Switch";
import { Tag } from "@formbricks/ui/Tag";

interface HiddenFieldsCardProps {
  localSurvey: TSurvey;
  setLocalSurvey: (survey: TSurvey) => void;
  activeQuestionId: string | null;
  setActiveQuestionId: (questionId: string | null) => void;
}

export const HiddenFieldsCard = ({
  activeQuestionId,
  localSurvey,
  setActiveQuestionId,
  setLocalSurvey,
}: HiddenFieldsCardProps) => {
  const open = activeQuestionId == "hidden";
  const [hiddenField, setHiddenField] = useState<string>("");

  const setOpen = (open: boolean) => {
    if (open) {
      setActiveQuestionId("hidden");
    } else {
      setActiveQuestionId(null);
    }
  };

  const updateSurvey = (data: TSurveyHiddenFields, currentFieldId?: string) => {
    const questions = [...localSurvey.questions];

    // Remove recall info from question headlines
    if (currentFieldId) {
      questions.forEach((question) => {
        for (const [languageCode, headline] of Object.entries(question.headline)) {
          if (headline.includes(`recall:${currentFieldId}`)) {
            const recallInfo = extractRecallInfo(headline);
            if (recallInfo) {
              question.headline[languageCode] = headline.replace(recallInfo, "");
            }
          }
        }
      });
    }

    setLocalSurvey({
      ...localSurvey,
      questions,
      hiddenFields: {
        ...localSurvey.hiddenFields,
        ...data,
      },
    });
  };

  return (
    <div className={cn(open ? "shadow-lg" : "shadow-md", "group z-10 flex flex-row rounded-lg bg-white")}>
      <div
        className={cn(
          open ? "bg-slate-50" : "bg-white group-hover:bg-slate-50",
          "flex w-10 items-center justify-center rounded-l-lg border-b border-l border-t group-aria-expanded:rounded-bl-none"
        )}>
        <p>🥷</p>
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
              <Label htmlFor="hidden-fields-toggle">
                {localSurvey?.hiddenFields?.enabled ? "On" : "Off"}
              </Label>

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
              localSurvey.hiddenFields?.fieldIds?.map((fieldId) => {
                return (
                  <Tag
                    key={fieldId}
                    onDelete={() => {
                      updateSurvey(
                        {
                          enabled: true,
                          fieldIds: localSurvey.hiddenFields?.fieldIds?.filter((q) => q !== fieldId),
                        },
                        fieldId
                      );
                    }}
                    tagId={fieldId}
                    tagName={fieldId}
                  />
                );
              })
            ) : (
              <p className="mt-2 text-sm italic text-slate-500">
                No hidden fields yet. Add the first one below.
              </p>
            )}
          </div>
          <form
            className="mt-5"
            onSubmit={(e) => {
              e.preventDefault();
              const existingQuestionIds = localSurvey.questions.map((question) => question.id);
              const existingEndingCardIds = localSurvey.endings.map((ending) => ending.id);
              const existingHiddenFieldIds = localSurvey.hiddenFields.fieldIds ?? [];
              const validateIdError = validateId(
                "Hidden field",
                hiddenField,
                existingQuestionIds,
                existingEndingCardIds,
                existingHiddenFieldIds
              );

              if (validateIdError) {
                toast.error(validateIdError);
                return;
              }

              updateSurvey({
                fieldIds: [...(localSurvey.hiddenFields?.fieldIds || []), hiddenField],
                enabled: true,
              });
              toast.success("Hidden field added successfully");
              setHiddenField("");
            }}>
            <Label htmlFor="headline">Hidden Field</Label>
            <div className="mt-2 flex gap-2">
              <Input
                autoFocus
                id="headline"
                name="headline"
                value={hiddenField}
                onChange={(e) => setHiddenField(e.target.value.trim())}
                placeholder="Type field id..."
              />
              <Button variant="secondary" type="submit" size="sm" className="whitespace-nowrap">
                Add hidden field ID
              </Button>
            </div>
          </form>
        </Collapsible.CollapsibleContent>
      </Collapsible.Root>
    </div>
  );
};
