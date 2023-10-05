"use client";

import { cn } from "@formbricks/lib/cn";
import { TSurveyWithAnalytics } from "@formbricks/types/v1/surveys";
import { Input, Label } from "@formbricks/ui";
import { EyeSlashIcon, XCircleIcon } from "@heroicons/react/24/outline";
import * as Collapsible from "@radix-ui/react-collapsible";
import { useState } from "react";

interface HiddenFieldsCardProps {
  localSurvey: TSurveyWithAnalytics;
  setLocalSurvey: (survey: TSurveyWithAnalytics) => void;
}

export default function HiddenFieldsCard({ localSurvey, setLocalSurvey }: HiddenFieldsCardProps) {
  const [open, setOpen] = useState(false);
  const [isValid, setIsValid] = useState(true);
  const openSetting = (e) => {
    if (e) {
      setOpen(true);
    } else {
      setOpen(false);
    }
  };

  const updateSurvey = (data) => {
    setLocalSurvey({
      ...localSurvey,
      hiddenFieldsCard: {
        ...localSurvey.hiddenFieldsCard,
        ...data,
      },
    });
  };

  const addHiddenFieldsHandler = (e) => {
    if (!isValidHiddenField(e.target.value)) {
      setIsValid(false);
      return;
    }

    if (e.key === "Enter") {
      const fieldToAdd =
        localSurvey?.hiddenFieldsCard?.hiddenFields?.length > 0
          ? [...localSurvey?.hiddenFieldsCard?.hiddenFields, e.target.value]
          : [e.target.value];
      updateSurvey({ hiddenFields: fieldToAdd });
    }

    if (!isValid) setIsValid(true);
  };

  const isValidHiddenField = (inputValue = "") => {
    const hiddenFields = localSurvey?.hiddenFieldsCard?.hiddenFields;
    const shouldNotContainValues = ["userId", "suid"];

    if (inputValue.includes(" ")) return false;

    let hasForbiddenValues = hiddenFields?.some((element) => shouldNotContainValues.includes(element));
    hasForbiddenValues = shouldNotContainValues.includes(inputValue);

    if (hasForbiddenValues) return false;
    return true;
  };

  return (
    <div
      className={cn(
        open ? "scale-100 shadow-lg " : "scale-97 shadow-md",
        "flex flex-row overflow-y-hidden overflow-y-scroll rounded-lg bg-white transition-transform duration-300 ease-in-out"
      )}>
      <div
        className={cn(
          open ? "bg-slate-700" : "bg-slate-400",
          "flex w-10 items-center justify-center rounded-l-lg hover:bg-slate-600 group-aria-expanded:rounded-bl-none"
        )}>
        <EyeSlashIcon className="h-5 w-5 text-white" />
      </div>
      <Collapsible.Root
        open={open}
        onOpenChange={openSetting}
        className="flex-1 rounded-r-lg border border-slate-200 transition-all duration-300 ease-in-out">
        <Collapsible.CollapsibleTrigger
          asChild
          className="flex cursor-pointer justify-between p-4 hover:bg-slate-50">
          <div>
            <div className="inline-flex">
              <div>
                <p className="text-sm font-semibold">Hidden Fields</p>
                {!open && (
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {localSurvey?.thankYouCard?.enabled ? "Add hidden fields to your survery" : "Hidden"}
                  </p>
                )}
              </div>
            </div>
          </div>
        </Collapsible.CollapsibleTrigger>
        <Collapsible.CollapsibleContent className="space-y-2 px-4 pb-6">
          <div className="grid auto-cols-min grid-flow-col auto-rows-max gap-2">
            {localSurvey.hiddenFieldsCard?.hiddenFields.map((field) => (
              <div className="flex w-fit space-x-2 rounded-lg bg-slate-200 p-2">
                <EyeSlashIcon className="h-5 w-5 text-slate-500" />
                <p className="text-sm font-semibold">{field}</p>
                <button
                  onClick={() =>
                    updateSurvey({
                      hiddenFields: localSurvey.hiddenFieldsCard.hiddenFields.filter(
                        (item) => item !== field
                      ),
                    })
                  }
                  className="w-fit text-slate-500 hover:text-slate-700">
                  <XCircleIcon className="h-5 w-5" />
                </button>
              </div>
            ))}
          </div>
          <Label>Add fields</Label>
          <Input isInvalid={!isValid} onKeyDown={(e) => addHiddenFieldsHandler(e)} className="mt-2" />
        </Collapsible.CollapsibleContent>
      </Collapsible.Root>
    </div>
  );
}
