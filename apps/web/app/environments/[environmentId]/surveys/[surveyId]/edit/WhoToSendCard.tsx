"use client";

import { cn } from "@formbricks/lib/cn";
import type { Survey } from "@formbricks/types/surveys";
import { Badge, Label, RadioGroup, RadioGroupItem } from "@formbricks/ui";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import * as Collapsible from "@radix-ui/react-collapsible";
import { useState } from "react";

const options = [
  {
    id: "all",
    name: "Survey all people",
    description: "Potentially, all users can be surveyed.",
    disabled: false,
  },
  {
    id: "filter",
    name: "Filter based on attributes",
    description: "Only people with specific attributes can be surveyed.",
    disabled: false,
  },
];

interface WhoToSendToCardProps {
  localSurvey: Survey;
  setLocalSurvey: (survey: Survey) => void;
}

export default function WhoToSendToCard({ localSurvey, setLocalSurvey }: WhoToSendToCardProps) {
  const [open, setOpen] = useState(false);

  if (localSurvey.type === "link") {
    return null;
  }

  /*  const addAttributeFilter = () => {
    const updatedSurvey = { ...localSurvey };
    updatedSurvey.attributeFilters = [...localSurvey.triggers, ""];
    setLocalSurvey(updatedSurvey);
  };

  const setAttributeFilter = (idx: number, eventClassId: string) => {
    const updatedSurvey = { ...localSurvey };
    updatedSurvey.triggers[idx] = eventClassId;
    setLocalSurvey(updatedSurvey);
  };

  const removeAttributeFilter = (idx: number) => {
    const updatedSurvey = { ...localSurvey };
    updatedSurvey.triggers = [...localSurvey.triggers.slice(0, idx), ...localSurvey.triggers.slice(idx + 1)];
    setLocalSurvey(updatedSurvey);
  }; */

  const changeRadioSelection = (value: string) => {
    const updatedSurvey = { ...localSurvey };
    if (value === "all") {
      updatedSurvey.attributeFilters = null;
    } else {
      updatedSurvey.attributeFilters = [];
    }
    setLocalSurvey(updatedSurvey);
  };

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={setOpen}
      className={cn(
        open ? "" : "hover:bg-slate-50",
        "w-full space-y-2 rounded-lg border border-slate-300 bg-white "
      )}>
      <Collapsible.CollapsibleTrigger asChild className="h-full w-full cursor-pointer">
        <div className="inline-flex px-4 py-6">
          <div className="flex items-center pl-2 pr-5">
            <CheckCircleIcon className="h-8 w-8 text-green-400" />
          </div>
          <div>
            <p className="font-semibold text-slate-800">Who to ask</p>
            <p className="mt-1 truncate text-sm text-slate-500">Filter your users based on attributes.</p>
          </div>
        </div>
      </Collapsible.CollapsibleTrigger>
      <Collapsible.CollapsibleContent>
        <hr className="py-1 text-slate-600" />
        <div className="p-3">
          <RadioGroup
            className="flex flex-col space-y-3"
            defaultValue="all"
            value={localSurvey.attributeFilters === null ? "all" : "filter"}
            onValueChange={changeRadioSelection}>
            {options.map((option) => (
              <Label
                key={option.id}
                htmlFor={option.id}
                className={cn(
                  "flex w-full  items-center rounded-lg border bg-slate-50 p-4",
                  option.disabled
                    ? "border-slate-200 bg-slate-50/50"
                    : "border-brand-dark cursor-pointer bg-slate-50"
                )}>
                <RadioGroupItem
                  value={option.id}
                  id={option.id}
                  disabled={option.disabled}
                  className="aria-checked:border-brand-dark  mx-5 disabled:cursor-not-allowed disabled:border-slate-400 aria-checked:border-2"
                />
                <div>
                  <div className="inline-flex items-center">
                    <p className={cn("font-semibold", option.disabled ? "text-slate-500" : "text-slate-800")}>
                      {option.name}
                    </p>
                    {option.disabled && <Badge text="coming soon" size="normal" type="warning" />}
                  </div>
                  <p className="mt-2 text-xs font-normal text-slate-600">{option.description}</p>
                </div>
              </Label>
            ))}
          </RadioGroup>
        </div>
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
}
