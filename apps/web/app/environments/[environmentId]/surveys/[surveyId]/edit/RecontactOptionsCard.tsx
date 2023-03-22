"use client";

import { Checkbox } from "@/components/ui/Checkbox";
import { Label } from "@/components/ui/Label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/RadioGroup";
import { Survey } from "@/types/surveys";
import * as Collapsible from "@radix-ui/react-collapsible";
import { useState } from "react";

const displayOptions = [
  {
    id: "false",
    name: "Show once per person",
    description: "Every person can see this survey only once.",
  },
  {
    id: "true",
    name: "Can be shown multiple times per person",
    description: "A person can see this survey multiple times.",
  },
];

const responseOptions = [
  {
    id: "false",
    name: "One response per person",
    description: "Every person can respond to this survey only once.",
  },
  {
    id: "true",
    name: "Multiple responses per person",
    description: "A person can respond to this survey multiple times.",
  },
];

/* const recontactOptions = [
  {
    id: "false",
    name: "Ignore waiting period, always show this survey.",
    description: "This survey will be shown even if the waiting period is not over yet.",
  },
  {
    id: "true",
    name: "Wait ___ days before showing this survey again.",
    description: "Overwrites waiting period between surveys to ___ days.",
  },
];
 */
interface RecontactOptionsCardProps {
  localSurvey: Survey;
  setLocalSurvey: (survey: Survey) => void;
}

export default function RecontactOptionsCard({ localSurvey, setLocalSurvey }: RecontactOptionsCardProps) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={setOpen}
      className="w-full space-y-2 rounded-lg border border-slate-300 bg-white">
      <Collapsible.CollapsibleTrigger asChild className="h-full w-full cursor-pointer">
        <div className="inline-flex px-4 py-6">
          <div className="flex items-center pr-5 pl-2">
            {/*   {!displayType ? (
              <div className="h-7 w-7 rounded-full border border-slate-400" />
            ) : (
              <CheckCircleIcon className="h-8 w-8 text-teal-400" />
            )} */}
          </div>
          <div>
            <p className="text-lg font-semibold text-slate-800">Recontact Options</p>
            <p className="mt-1 truncate text-sm text-slate-500">
              Decide how often people can answer this survey.
            </p>
          </div>
        </div>
      </Collapsible.CollapsibleTrigger>
      <Collapsible.CollapsibleContent>
        <hr className="py-1 text-slate-600" />
        <div className="p-3">
          <p>How often can it be seen</p>
          <RadioGroup
            value={localSurvey.allowMultipleDisplays.toString()}
            className="flex flex-col space-y-3"
            onValueChange={(v) => {
              const updatedSurvey = { ...localSurvey };
              updatedSurvey.allowMultipleDisplays = v === "true";
              setLocalSurvey(updatedSurvey);
            }}>
            {displayOptions.map((option) => (
              <Label
                htmlFor={option.id}
                className="flex w-full cursor-pointer items-center rounded-lg border bg-slate-50 p-4">
                <RadioGroupItem
                  value={option.id}
                  id={option.id}
                  className="aria-checked:border-brand-dark  mx-5 disabled:border-slate-400 aria-checked:border-2"
                />
                <div className="">
                  <p className="font-semibold text-slate-700">{option.name}</p>

                  <p className="mt-2 text-xs font-normal text-slate-600">{option.description}</p>
                </div>
              </Label>
            ))}
          </RadioGroup>
        </div>
        <div className="p-3">
          <p>How often can it be filled out</p>
          <RadioGroup
            value={localSurvey.allowMultipleResponses.toString()}
            className="flex flex-col space-y-3"
            onValueChange={(v) => {
              const updatedSurvey = { ...localSurvey };
              updatedSurvey.allowMultipleResponses = v === "true";
              setLocalSurvey(updatedSurvey);
            }}>
            {responseOptions.map((option) => (
              <Label
                htmlFor={option.id}
                className="flex w-full cursor-pointer items-center rounded-lg border bg-slate-50 p-4">
                <RadioGroupItem
                  value={option.id}
                  id={option.id}
                  className="aria-checked:border-brand-dark  mx-5 disabled:border-slate-400 aria-checked:border-2"
                />
                <div className="">
                  <p className="font-semibold text-slate-700">{option.name}</p>

                  <p className="mt-2 text-xs font-normal text-slate-600">{option.description}</p>
                </div>
              </Label>
            ))}
          </RadioGroup>
        </div>
        <div className="p-3">
          <p>Advanced Settings</p>
          <Checkbox />
          <Label>Overwrite Waiting Time (Throttling)</Label>
          {/*          <RadioGroup
            value={localSurvey.recontactDays.toString()}
            className="flex flex-col space-y-3"
            onValueChange={(v) => {
              const updatedSurvey = { ...localSurvey };
              updatedSurvey.recontactDays = v;
              setLocalSurvey(updatedSurvey);
            }}>
            {recontactOptions.map((option) => (
              <Label
                htmlFor={option.id}
                className="flex w-full cursor-pointer items-center rounded-lg border bg-slate-50 p-4">
                <RadioGroupItem
                  value={option.id}
                  id={option.id}
                  className="aria-checked:border-brand-dark  mx-5 disabled:border-slate-400 aria-checked:border-2"
                />
                <div className="">
                  <p className="font-semibold text-slate-700">{option.name}</p>

                  <p className="mt-2 text-xs font-normal text-slate-600">{option.description}</p>
                </div>
              </Label>
            ))}
          </RadioGroup> */}
        </div>
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
}
